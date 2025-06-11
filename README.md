# Omics AI MCP Server

A Model Context Protocol (MCP) server that enables AI agents to conversationally interact with Omics AI Explorer networks for genomics research and data analysis.

## Overview

This MCP server wraps the functionality of the [omics-ai-python-library](https://github.com/mfiume/omics-ai-python-library) to provide AI agents with seamless access to genomics data across multiple Omics AI Explorer networks including:

- **HiFi Solves** (hifisolves.org) - Long-read sequencing data
- **Neuroscience AI** (neuroscience.ai) - Neuroscience genomics data  
- **ASAP** (cloud.parkinsonsroadmap.org) - Aligning Science Across Parkinson's
- **Viral AI** (viral.ai) - Viral genomics and surveillance data
- **Target ALS** (dataportal.targetals.org) - ALS research data

## Features

The MCP server provides the following tools for AI agents:

- **`list_collections`** - Discover available data collections in any network
- **`list_tables`** - Browse tables within specific collections  
- **`get_schema_fields`** - Examine table schemas and field types
- **`query_table`** - Query data with filters, pagination, and ordering
- **`count_rows`** - Count rows matching specific criteria

## Installation

```bash
git clone https://github.com/mfiume/omics-ai-mcp.git
cd omics-ai-mcp
npm install
```

## Usage

### Running the Server

```bash
npm start
```

### Configuration for Claude Desktop

Add to your Claude Desktop configuration file:

```json
{
  "mcpServers": {
    "omics-ai": {
      "command": "node",
      "args": ["src/index.js"],
      "cwd": "/path/to/omics-ai-mcp"
    }
  }
}
```

### Example AI Agent Interactions

Once configured, AI agents can conversationally query genomics data:

> **Agent**: "What collections are available on the Viral AI network?"

> **User**: "Show me the tables in the virusseq collection"

> **Agent**: "List the first 10 variants from the variants table where chromosome equals chr1"

> **User**: "How many total variants are in the VirusSeq database?"

## Tool Reference

### list_collections

Lists all available collections in a network.

**Parameters:**
- `network` (required): Network name (hifisolves, viral, neuroscience, etc.) or full URL
- `access_token` (optional): Authentication token

### list_tables  

Lists all tables in a specific collection.

**Parameters:**
- `network` (required): Network name or URL
- `collection_slug` (required): Collection identifier (e.g., "virusseq", "gnomad")
- `access_token` (optional): Authentication token

### get_schema_fields

Retrieves the schema and field definitions for a table.

**Parameters:**
- `network` (required): Network name or URL
- `collection_slug` (required): Collection identifier  
- `table_name` (required): Qualified table name (e.g., "collections.virusseq.variants")
- `access_token` (optional): Authentication token

### query_table

Queries data from a table with optional filtering and pagination.

**Parameters:**
- `network` (required): Network name or URL
- `collection_slug` (required): Collection identifier
- `table_name` (required): Qualified table name
- `filters` (optional): Filter criteria object
- `limit` (optional): Max rows to return (default: 100)
- `offset` (optional): Rows to skip (default: 0)  
- `order_by` (optional): Sort specification
- `access_token` (optional): Authentication token

### count_rows

Counts rows matching specified filters.

**Parameters:**
- `network` (required): Network name or URL  
- `collection_slug` (required): Collection identifier
- `table_name` (required): Qualified table name
- `filters` (optional): Filter criteria object
- `access_token` (optional): Authentication token

## Supported Networks

The server supports these pre-configured networks (use short names for convenience):

| Short Name | Full URL | Description |
|------------|----------|-------------|
| hifisolves | hifisolves.org | Long-read sequencing data |
| neuroscience | neuroscience.ai | Neuroscience genomics |
| asap | cloud.parkinsonsroadmap.org | Parkinson's research |
| viral | viral.ai | Viral genomics |
| targetals | dataportal.targetals.org | ALS research |

## Error Handling

The server includes robust error handling for:
- Network connectivity issues
- Authentication failures  
- Invalid parameters
- API response parsing errors
- Timeout handling for long-running queries

## Development

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

## License

MIT License - see LICENSE file for details.

## Related Projects

- [omics-ai-python-library](https://github.com/mfiume/omics-ai-python-library) - Python client library
- [Model Context Protocol](https://github.com/modelcontextprotocol) - MCP specification and SDKs