#!/usr/bin/env node

import express from 'express';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json({ limit: '50mb' }));

// Store active MCP server processes
const activeSessions = new Map();

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'omics-ai-mcp',
    version: '1.0.0',
    activeSessions: activeSessions.size
  });
});

// Create a new MCP session
app.post('/session', (req, res) => {
  const sessionId = uuidv4();
  
  // Spawn the MCP server as a child process
  const mcpProcess = spawn('node', ['src/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env }
  });

  const session = {
    id: sessionId,
    process: mcpProcess,
    buffer: '',
    responses: []
  };

  // Handle stdout data from MCP server
  mcpProcess.stdout.on('data', (data) => {
    session.buffer += data.toString();
    
    // Try to parse complete JSON-RPC messages
    const lines = session.buffer.split('\n');
    session.buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          session.responses.push(message);
        } catch (e) {
          console.error('Failed to parse MCP response:', e);
        }
      }
    }
  });

  // Handle stderr
  mcpProcess.stderr.on('data', (data) => {
    console.error(`MCP stderr [${sessionId}]:`, data.toString());
  });

  // Handle process exit
  mcpProcess.on('exit', (code) => {
    console.log(`MCP process [${sessionId}] exited with code ${code}`);
    activeSessions.delete(sessionId);
  });

  activeSessions.set(sessionId, session);

  res.json({ sessionId });
});

// Send a message to an MCP session
app.post('/session/:sessionId/message', async (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Clear previous responses
  session.responses = [];

  // Send message to MCP server
  try {
    session.process.stdin.write(JSON.stringify(message) + '\n');

    // Wait for response with timeout
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (session.responses.length === 0) {
      if (Date.now() - startTime > timeout) {
        return res.status(504).json({ error: 'Request timeout' });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Return the first response
    res.json(session.responses[0]);
  } catch (error) {
    console.error('Error sending message to MCP:', error);
    res.status(500).json({ error: 'Failed to send message to MCP server' });
  }
});

// Close an MCP session
app.delete('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Kill the MCP process
  session.process.kill();
  activeSessions.delete(sessionId);

  res.json({ message: 'Session closed' });
});

// List active sessions
app.get('/sessions', (req, res) => {
  const sessions = Array.from(activeSessions.keys()).map(id => ({
    id,
    active: true
  }));
  res.json({ sessions });
});

// SSE endpoint for MCP compatibility - improved implementation
app.get('/sse', (req, res) => {
  // Set SSE headers exactly like Pipedream
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Connection', 'keep-alive');
  
  // Generate session ID for this connection
  const sessionId = uuidv4();
  
  // Send endpoint information exactly like Pipedream does
  const endpointUrl = `/v1/omics-ai-mcp/messages?sessionId=${sessionId}`;
  
  res.write(`event: endpoint\n`);
  res.write(`data: ${endpointUrl}\n\n`);
  
  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(`: keepalive\n\n`);
  }, 30000);
  
  req.on('close', () => {
    clearInterval(keepAlive);
    console.log(`SSE endpoint connection closed [${sessionId}]`);
  });
  
  req.on('error', () => {
    clearInterval(keepAlive);
  });
});

// MCP Messages endpoint for Streamable HTTP protocol
app.post('/v1/omics-ai-mcp/messages', async (req, res) => {
  const { sessionId } = req.query;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId query parameter is required' });
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  try {
    // Get or create MCP session
    let session = activeSessions.get(sessionId);
    
    if (!session) {
      // Create new MCP process for this session
      const mcpProcess = spawn('node', ['src/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      session = {
        id: sessionId,
        process: mcpProcess,
        buffer: '',
        responses: []
      };

      // Handle stdout data from MCP server
      mcpProcess.stdout.on('data', (data) => {
        session.buffer += data.toString();
        
        // Try to parse complete JSON-RPC messages
        const lines = session.buffer.split('\n');
        session.buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              session.responses.push(message);
            } catch (e) {
              console.error('Failed to parse MCP response:', e);
            }
          }
        }
      });

      // Handle stderr
      mcpProcess.stderr.on('data', (data) => {
        console.error(`MCP stderr [${sessionId}]:`, data.toString());
      });

      // Handle process exit
      mcpProcess.on('exit', (code) => {
        console.log(`MCP process [${sessionId}] exited with code ${code}`);
        activeSessions.delete(sessionId);
      });

      activeSessions.set(sessionId, session);
    }

    // Clear previous responses
    session.responses = [];

    // Send message to MCP server
    const message = req.body;
    session.process.stdin.write(JSON.stringify(message) + '\n');

    // Wait for response with timeout
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (session.responses.length === 0) {
      if (Date.now() - startTime > timeout) {
        return res.status(504).json({ error: 'Request timeout' });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Return the response
    res.json(session.responses[0]);
  } catch (error) {
    console.error('Error handling MCP message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Handle OPTIONS requests for CORS
app.options('/v1/omics-ai-mcp/messages', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(200).end();
});

// Cleanup on server shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down HTTP wrapper...');
  
  // Kill all active MCP processes
  for (const [sessionId, session] of activeSessions) {
    console.log(`Killing session ${sessionId}`);
    session.process.kill();
  }
  
  process.exit(0);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Omics AI MCP HTTP wrapper listening on port ${PORT}`);
});