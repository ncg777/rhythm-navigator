import { describe, expect, it } from 'vitest'
import { registerMcpTools } from './mcp'

type RegisteredTool = {
  name: string
  description: string
  schema: unknown
  handler: (params: any) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>
}

function createRegistrar(tools: RegisteredTool[]) {
  return {
    tool(name: string, description: string, schema: unknown, handler: RegisteredTool['handler']) {
      tools.push({ name, description, schema, handler })
    }
  }
}

describe('registerMcpTools', () => {
  it('registers the matrix generation tool', () => {
    const tools: RegisteredTool[] = []

    registerMcpTools(createRegistrar(tools) as any)

    expect(tools.some(tool => tool.name === 'generate_rhythm_matrix')).toBe(true)
  })

  it('returns matrix results in the MCP response payload', async () => {
    const tools: RegisteredTool[] = []

    registerMcpTools(createRegistrar(tools) as any)

    const matrixTool = tools.find(tool => tool.name === 'generate_rhythm_matrix')
    expect(matrixTool).toBeDefined()

    const response = await matrixTool!.handler({
      mode: 'binary',
      numerator: 2,
      denominator: 1,
      rowCount: 1,
      columnCount: 2,
      maxResults: 1,
      maxAttempts: 1000,
      maxCellRetries: 50,
      predicates: []
    })

    const payload = JSON.parse(response.content[0].text)

    expect(payload.method).toBe('matrix')
    expect(payload.count).toBe(payload.matrices.length)
    expect(payload.controls.rowCount).toBe(1)
    expect(payload.controls.columnCount).toBe(2)
    expect(Array.isArray(payload.matrices)).toBe(true)
  })
})