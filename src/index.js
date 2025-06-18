#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import axios from "axios";

class OmicsAIMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "omics-ai-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "list_collections",
            description: "List all collections available in an Omics AI Explorer network",
            inputSchema: {
              type: "object",
              properties: {
                network: {
                  type: "string",
                  description: "Network name (hifisolves, neuroscience, asap, viral, targetals) or full URL",
                  examples: ["hifisolves", "viral", "neuroscience.ai"]
                },
                access_token: {
                  type: "string",
                  description: "Optional access token for authentication",
                }
              },
              required: ["network"]
            }
          },
          {
            name: "list_tables",
            description: "List all tables in a specific collection",
            inputSchema: {
              type: "object",
              properties: {
                network: {
                  type: "string",
                  description: "Network name or URL",
                },
                collection_slug: {
                  type: "string",
                  description: "Collection slug name (e.g., 'gnomad', 'virusseq')",
                },
                access_token: {
                  type: "string",
                  description: "Optional access token for authentication",
                }
              },
              required: ["network", "collection_slug"]
            }
          },
          {
            name: "get_schema_fields",
            description: "Get the schema fields for a specific table",
            inputSchema: {
              type: "object",
              properties: {
                network: {
                  type: "string",
                  description: "Network name or URL",
                },
                collection_slug: {
                  type: "string", 
                  description: "Collection slug name",
                },
                table_name: {
                  type: "string",
                  description: "Qualified table name (e.g., 'collections.gnomad.variants')",
                },
                access_token: {
                  type: "string",
                  description: "Optional access token for authentication",
                }
              },
              required: ["network", "collection_slug", "table_name"]
            }
          },
          {
            name: "query_table",
            description: "Query data from a table with optional filters and pagination",
            inputSchema: {
              type: "object",
              properties: {
                network: {
                  type: "string",
                  description: "Network name or URL",
                },
                collection_slug: {
                  type: "string",
                  description: "Collection slug name",
                },
                table_name: {
                  type: "string",
                  description: "Qualified table name",
                },
                filters: {
                  type: "object",
                  description: "Dictionary of filters to apply",
                  additionalProperties: true
                },
                limit: {
                  type: "integer",
                  description: "Maximum number of rows to return (default: 100)",
                  default: 100
                },
                offset: {
                  type: "integer", 
                  description: "Number of rows to skip (default: 0)",
                  default: 0
                },
                order_by: {
                  type: "object",
                  description: "Ordering specification",
                  properties: {
                    field: { type: "string" },
                    direction: { type: "string", enum: ["ASC", "DESC"] }
                  }
                },
                access_token: {
                  type: "string",
                  description: "Optional access token for authentication",
                }
              },
              required: ["network", "collection_slug", "table_name"]
            }
          },
          {
            name: "count_rows",
            description: "Count the number of rows matching given filters",
            inputSchema: {
              type: "object",
              properties: {
                network: {
                  type: "string",
                  description: "Network name or URL",
                },
                collection_slug: {
                  type: "string",
                  description: "Collection slug name",
                },
                table_name: {
                  type: "string",
                  description: "Qualified table name",
                },
                filters: {
                  type: "object",
                  description: "Dictionary of filters to apply",
                  additionalProperties: true
                },
                access_token: {
                  type: "string",
                  description: "Optional access token for authentication",
                }
              },
              required: ["network", "collection_slug", "table_name"]
            }
          },
          {
            name: "sql_search",
            description: "Execute a SQL query against a collection using Trino syntax",
            inputSchema: {
              type: "object",
              properties: {
                network: {
                  type: "string",
                  description: "Network name or URL",
                },
                collection_slug: {
                  type: "string",
                  description: "Collection slug name",
                },
                sql: {
                  type: "string",
                  description: "SQL query string (use Trino syntax with double quotes for identifiers)",
                },
                max_polls: {
                  type: "integer",
                  description: "Maximum number of polling attempts (default: 10)",
                  default: 10
                },
                poll_interval: {
                  type: "number",
                  description: "Seconds to wait between polls (default: 2.0)",
                  default: 2.0
                },
                access_token: {
                  type: "string",
                  description: "Optional access token for authentication",
                }
              },
              required: ["network", "collection_slug", "sql"]
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "list_collections":
            return await this.listCollections(args);
          case "list_tables":
            return await this.listTables(args);
          case "get_schema_fields":
            return await this.getSchemaFields(args);
          case "query_table":
            return await this.queryTable(args);
          case "count_rows":
            return await this.countRows(args);
          case "sql_search":
            return await this.sqlSearch(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`
            }
          ]
        };
      }
    });
  }

  // Known networks mapping
  getNetworkUrl(network) {
    const knownNetworks = {
      "hifisolves": "hifisolves.org",
      "neuroscience": "neuroscience.ai", 
      "asap": "cloud.parkinsonsroadmap.org",
      "parkinsons": "cloud.parkinsonsroadmap.org",
      "biomedical": "biomedical.ai",
      "viral": "viral.ai",
      "targetals": "dataportal.targetals.org"
    };

    if (network in knownNetworks) {
      network = knownNetworks[network];
    }

    if (!network.startsWith('http://') && !network.startsWith('https://')) {
      network = `https://${network}`;
    }

    return network.replace(/\/$/, '');
  }

  // Create HTTP client with proper headers
  createHttpClient(network, access_token) {
    const headers = {
      'User-Agent': 'omics-ai-mcp-server/1.0.0',
      'Accept': 'application/json'
    };

    if (access_token) {
      headers['Authorization'] = `Bearer ${access_token}`;
    }

    return axios.create({
      baseURL: this.getNetworkUrl(network),
      headers,
      timeout: 30000
    });
  }

  // Parse JSON Lines response format
  parseJsonLinesResponse(rawText) {
    if (!rawText.trim()) {
      throw new Error("Empty response received");
    }

    const lines = rawText.trim().split('\n').map(line => line.trim()).filter(line => line);
    
    if (!lines.length) {
      throw new Error("No valid lines found in response");
    }

    const jsonObjects = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        jsonObjects.push(obj);
      } catch (e) {
        if (line !== "{}") {
          // Silently ignore parsing errors for robustness
        }
      }
    }

    if (!jsonObjects.length) {
      throw new Error("No valid JSON objects found in response");
    }

    // Find the object with data (usually the last non-empty one)
    for (let i = jsonObjects.length - 1; i >= 0; i--) {
      const obj = jsonObjects[i];
      if (obj && 'data' in obj) {
        return obj;
      }
    }

    // If no data object found, check for next_page_token (polling case)
    for (let i = jsonObjects.length - 1; i >= 0; i--) {
      const obj = jsonObjects[i];
      if (obj && 'next_page_token' in obj) {
        return obj;
      }
    }

    // Return the last non-empty object
    const nonEmptyObjects = jsonObjects.filter(obj => obj && Object.keys(obj).length > 0);
    if (nonEmptyObjects.length) {
      return nonEmptyObjects[nonEmptyObjects.length - 1];
    }

    throw new Error("No data or next_page_token found in response");
  }

  async listCollections(args) {
    const { network, access_token } = args;
    const client = this.createHttpClient(network, access_token);

    try {
      const response = await client.get('/api/collections');
      const collections = response.data;

      if (!Array.isArray(collections)) {
        throw new Error("Expected list of collections but got something else");
      }

      return {
        content: [
          {
            type: "text",
            text: `Found ${collections.length} collections in ${network}:\n\n` +
                  collections.map(c => `• **${c.name}** (${c.slugName})\n  ${c.description || 'No description'}`).join('\n\n')
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to list collections: ${error.message}`);
    }
  }

  async listTables(args) {
    const { network, collection_slug, access_token } = args;
    const client = this.createHttpClient(network, access_token);

    try {
      const response = await client.get(`/api/collections/${encodeURIComponent(collection_slug)}/tables`);
      const tables = response.data;

      if (!Array.isArray(tables)) {
        throw new Error("Expected list of tables but got something else");
      }

      return {
        content: [
          {
            type: "text",
            text: `Found ${tables.length} tables in collection '${collection_slug}':\n\n` +
                  tables.map(t => `• **${t.display_name}** (${t.qualified_table_name || t.name})\n  ${t.size ? `${t.size.toLocaleString()} rows` : 'Size unknown'}`).join('\n\n')
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to list tables: ${error.message}`);
    }
  }

  async getSchemaFields(args) {
    const { network, collection_slug, table_name, access_token } = args;
    const client = this.createHttpClient(network, access_token);

    try {
      const response = await client.get(`/api/collection/${encodeURIComponent(collection_slug)}/data-connect/table/${encodeURIComponent(table_name)}/info`);
      const schema = response.data;
      const dataModel = schema?.data_model?.properties || {};

      if (!dataModel || Object.keys(dataModel).length === 0) {
        throw new Error("No schema (data_model.properties) found in response");
      }

      const fields = [];
      for (const [fieldName, fieldSpec] of Object.entries(dataModel)) {
        let fieldType = fieldSpec.type || '';
        if (Array.isArray(fieldType)) {
          fieldType = fieldType.join(', ');
        }

        if (fieldType === 'array' && fieldSpec.items) {
          let itemType = fieldSpec.items.type || '';
          if (Array.isArray(itemType)) {
            itemType = itemType.join(', ');
          }
          fieldType = `array<${itemType}>`;
        }

        fields.push({
          field: fieldName,
          type: fieldType,
          sql_type: fieldSpec.sqlType || ''
        });
      }

      return {
        content: [
          {
            type: "text",
            text: `Schema for table '${table_name}' (${fields.length} fields):\n\n` +
                  fields.map(f => `• **${f.field}**: ${f.type}${f.sql_type ? ` (SQL: ${f.sql_type})` : ''}`).join('\n')
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get schema: ${error.message}`);
    }
  }

  async queryTable(args) {
    const { 
      network, 
      collection_slug, 
      table_name, 
      filters = {}, 
      limit = 100, 
      offset = 0, 
      order_by, 
      access_token 
    } = args;
    
    const client = this.createHttpClient(network, access_token);

    const payload = {
      tableName: table_name,
      filters,
      pagination: { limit, offset }
    };

    if (order_by) {
      payload.order = order_by;
    }

    try {
      // Implement polling for async queries
      const maxPolls = 10;
      const pollInterval = 2000; // 2 seconds

      for (let pollCount = 0; pollCount < maxPolls; pollCount++) {
        const response = await client.post(
          `/api/collections/${encodeURIComponent(collection_slug)}/tables/${encodeURIComponent(table_name)}/filter`,
          payload,
          {
            headers: { 'Content-Type': 'application/json' }
          }
        );

        const result = this.parseJsonLinesResponse(response.data);

        if ('data' in result && Array.isArray(result.data)) {
          const summary = `Query returned ${result.data.length} rows from '${table_name}'`;
          const pagination = result.pagination ? 
            `\nPagination: showing ${result.pagination.offset || 0} to ${(result.pagination.offset || 0) + result.data.length} of ${result.pagination.total || 'unknown'} total rows` : '';
          
          return {
            content: [
              {
                type: "text",
                text: `${summary}${pagination}\n\nFirst few rows:\n` +
                      JSON.stringify(result.data.slice(0, 5), null, 2)
              }
            ]
          };
        } else if ('next_page_token' in result) {
          if (result.next_page_token !== 'empty_response_poll') {
            payload.next_page_token = result.next_page_token;
          }
          if (pollCount < maxPolls - 1) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }
        } else {
          throw new Error(`Unexpected response format: ${Object.keys(result)}`);
        }
      }

      throw new Error(`Query timed out after ${maxPolls} polls`);
    } catch (error) {
      throw new Error(`Failed to query table: ${error.message}`);
    }
  }

  async countRows(args) {
    const { network, collection_slug, table_name, filters = {}, access_token } = args;
    const client = this.createHttpClient(network, access_token);

    const payload = { filters };

    try {
      const response = await client.post(
        `/api/collections/${encodeURIComponent(collection_slug)}/tables/${encodeURIComponent(table_name)}/filter/count`,
        payload,
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      const result = this.parseJsonLinesResponse(response.data);
      const count = result.count || 0;

      return {
        content: [
          {
            type: "text",
            text: `Count result: ${count.toLocaleString()} rows in '${table_name}'${Object.keys(filters).length ? ' matching the specified filters' : ''}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to count rows: ${error.message}`);
    }
  }

  async sqlSearch(args) {
    const { 
      network, 
      collection_slug, 
      sql, 
      max_polls = 10, 
      poll_interval = 2.0, 
      access_token 
    } = args;
    
    const client = this.createHttpClient(network, access_token);
    const payload = { query: sql };

    try {
      // Initial SQL query request
      const response = await client.post(
        `/api/collection/${encodeURIComponent(collection_slug)}/data-connect/search`,
        payload,
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      let result;
      if (response.headers['content-type'] && response.headers['content-type'].startsWith('application/json')) {
        result = response.data;
      } else {
        try {
          result = JSON.parse(response.data);
        } catch (e) {
          throw new Error(`Invalid JSON response: ${response.data.substring(0, 200)}...`);
        }
      }

      // Check for immediate errors
      if (result.errors && result.errors.length > 0) {
        const errorDetails = result.errors[0].details || 'Unknown error';
        throw new Error(`SQL query error: ${errorDetails}`);
      }

      // Check if we have immediate data (unlikely but possible)
      if (result.data && result.data.length > 0) {
        return this.formatSqlResults(result, sql);
      }

      // Check if we need to poll
      let nextPageUrl = result.pagination?.next_page_url;
      if (!nextPageUrl) {
        // No pagination URL but empty data - query completed with no results
        return {
          content: [
            {
              type: "text",
              text: `SQL query completed with no results\n\nQuery: ${sql}`
            }
          ]
        };
      }

      // Poll for results with improved logic
      return await this.pollSqlResults(client, nextPageUrl, sql, max_polls, poll_interval);

    } catch (error) {
      throw new Error(`Failed to execute SQL query: ${error.message}`);
    }
  }

  async pollSqlResults(client, nextPageUrl, sql, max_polls, poll_interval) {
    for (let pollCount = 0; pollCount < max_polls; pollCount++) {
      await new Promise(resolve => setTimeout(resolve, poll_interval * 1000));

      try {
        const pollResponse = await client.get(nextPageUrl);
        let pollResult;
        
        if (pollResponse.headers['content-type'] && pollResponse.headers['content-type'].startsWith('application/json')) {
          pollResult = pollResponse.data;
        } else {
          try {
            pollResult = JSON.parse(pollResponse.data);
          } catch (e) {
            throw new Error(`Invalid JSON response: ${pollResponse.data.substring(0, 200)}...`);
          }
        }

        // Check for errors
        if (pollResult.errors && pollResult.errors.length > 0) {
          const errorDetails = pollResult.errors[0].details || 'Unknown error';
          throw new Error(`SQL query error: ${errorDetails}`);
        }

        // Check if we have data
        if (pollResult.data && pollResult.data.length > 0) {
          return this.formatSqlResults(pollResult, sql);
        }

        // Check if we should continue polling
        if (pollResult.data && pollResult.data.length === 0 && !pollResult.pagination?.next_page_url) {
          // Empty results with no next page - query completed with no matches
          return {
            content: [
              {
                type: "text",
                text: `SQL query completed with no results\n\nQuery: ${sql}`
              }
            ]
          };
        }

        // Continue polling if we have a next_page_url
        if (pollResult.pagination?.next_page_url) {
          nextPageUrl = pollResult.pagination.next_page_url;
          continue;
        }

        // No next page URL and empty data - return what we have
        return {
          content: [
            {
              type: "text",
              text: `SQL query completed with no results\n\nQuery: ${sql}`
            }
          ]
        };

      } catch (pollError) {
        if (pollCount < max_polls - 1) {
          continue; // Try again
        } else {
          throw new Error(`Polling failed: ${pollError.message}`);
        }
      }
    }

    throw new Error(`SQL query timed out after ${max_polls} polls (${max_polls * poll_interval}s)`);
  }

  formatSqlResults(result, sql) {
    const rowCount = result.data.length;
    const hasMore = result.pagination?.next_page_url ? true : false;
    const totalCount = result.pagination?.total || 'unknown';
    
    let summary = `SQL query returned ${rowCount.toLocaleString()} rows`;
    if (hasMore) {
      summary += ` (showing first ${rowCount}, total: ${totalCount})`;
    }

    // Format the preview data more nicely
    const previewData = result.data.slice(0, 5);
    let formattedData = '';
    
    if (previewData.length > 0) {
      // Try to format as table if data is simple enough
      const firstRow = previewData[0];
      const keys = Object.keys(firstRow);
      
      if (keys.length <= 8 && keys.every(k => firstRow[k] !== null && typeof firstRow[k] !== 'object')) {
        // Format as simple table
        formattedData = '\n**Sample Results:**\n';
        formattedData += keys.join(' | ') + '\n';
        formattedData += keys.map(() => '---').join(' | ') + '\n';
        
        for (const row of previewData) {
          formattedData += keys.map(k => String(row[k] || '')).join(' | ') + '\n';
        }
      } else {
        // Format as JSON
        formattedData = '\n**Sample Results (JSON):**\n```json\n' + 
                      JSON.stringify(previewData, null, 2) + '\n```';
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `${summary}\n\n**Query:** \`${sql}\`${formattedData}`
        }
      ]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Omics AI MCP server running on stdio");
  }
}

// Run the server
const server = new OmicsAIMCPServer();
server.run().catch(console.error);