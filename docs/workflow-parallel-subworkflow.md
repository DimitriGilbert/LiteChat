# Parallel Execution and Sub-Workflow Guide

LiteChat's workflow system now supports advanced execution patterns including **Parallel Execution** and **Sub-Workflows**, enabling sophisticated automation scenarios.

## Table of Contents

- [Parallel Execution](#parallel-execution)
- [Sub-Workflows](#sub-workflows)
- [Use Cases](#use-cases)
- [Configuration Examples](#configuration-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Parallel Execution

Parallel execution allows you to run the same step configuration across multiple data items simultaneously, dramatically improving workflow efficiency for batch processing tasks.

### How It Works

1. **Array Resolution**: The parallel step takes an array from previous step outputs
2. **Branch Creation**: Creates individual child interactions for each array item
3. **Concurrent Execution**: All branches run simultaneously (no concurrency limits)
4. **Result Aggregation**: Collects successful results into an array
5. **Error Handling**: Continues with partial results if some branches fail

### Configuration

#### Required Fields

- **Array Variable**: JSONPath to an array in previous step outputs
  - Example: `$.outputs[0].items` or `$.initial_step.data_array`
- **Parallel Step**: The step configuration to execute for each array item

#### Optional Fields

- **Model Variable**: If set, uses each array item as the model ID (race behavior)
- **Model Selection**: Override the default model for all parallel branches

### Available Context in Parallel Steps

Each parallel branch has access to:

- **Array Item**: The current array item as a template variable
- **Branch Index**: `branchIndex` (0, 1, 2, ...) - Zero-based index of current branch
- **Total Branches**: `totalBranches` - Total number of items in the original array being processed
- **Previous Outputs**: All previous workflow step outputs

**Example**: If processing an array of 5 documents, each branch will have `totalBranches = 5`, with `branchIndex` ranging from 0 to 4.

### Example Configuration

```json
{
  "id": "parallel_analysis",
  "name": "Analyze Multiple Documents",
  "type": "parallel",
  "parallelOn": "$.outputs[0].documents",
  "parallelStep": {
    "id": "doc_analysis",
    "name": "Document Analysis",
    "type": "prompt",
    "templateId": "document-analyzer-template",
    "modelId": "gpt-4"
  }
}
```

## Sub-Workflows

Sub-workflows allow you to execute entire workflows as individual steps, enabling modular workflow design and reusability.

### How It Works

1. **Template Loading**: Loads the specified workflow template
2. **Input Mapping**: Maps parent workflow context to sub-workflow variables
3. **Isolated Execution**: Runs the sub-workflow with its own interaction context
4. **Result Return**: Returns the final step's output to the parent workflow

### Configuration

#### Required Fields

- **Sub-Workflow Template**: Select an existing workflow to run as a sub-workflow

#### Optional Fields

- **Input Variable Mapping**: Map parent context to sub-workflow input variables
  - **Variable Name**: Name of the variable in the sub-workflow
  - **Source**: JSONPath query or static value from parent context

### Input Mapping Sources

- **JSONPath Queries**: `$.initial_step`, `$.outputs[0]`, `$.outputs[1]`, etc.
- **Static Values**: 
  - Strings: `"static text"`
  - Numbers: `123`
  - Booleans: `true` or `false`

### Example Configuration

```json
{
  "id": "sub_workflow_step",
  "name": "Run Content Processing",
  "type": "sub-workflow",
  "subWorkflowTemplateId": "content-processing-workflow",
  "subWorkflowInputMapping": {
    "content": "$.outputs[0].raw_content",
    "format": "\"markdown\"",
    "priority": "$.initial_step.urgency_level"
  }
}
```

## Use Cases

### Parallel Execution Use Cases

1. **Batch Content Analysis**
   - Analyze multiple documents simultaneously
   - Process arrays of user feedback
   - Generate summaries for multiple articles

2. **Multi-Model Racing**
   - Run the same prompt across different AI models
   - Compare responses from various providers
   - Find the best model for specific tasks

3. **Data Processing**
   - Transform multiple data records
   - Validate arrays of inputs
   - Generate reports for multiple entities

### Sub-Workflow Use Cases

1. **Modular Workflows**
   - Break complex workflows into reusable components
   - Create specialized processing pipelines
   - Maintain workflow libraries

2. **Conditional Processing**
   - Execute different workflows based on conditions
   - Handle various content types with specialized workflows
   - Implement decision trees

3. **Recursive Processing**
   - Process hierarchical data structures
   - Handle nested content analysis
   - Implement iterative refinement

## Configuration Examples

### Example 1: Multi-Document Analysis with Parallel Execution

```yaml
Workflow: "Research Paper Analysis"
Steps:
  1. Document Collection (Prompt)
     - Collects research papers
     - Outputs: { "papers": [...] }
  
  2. Parallel Analysis (Parallel)
     - Array Variable: "$.outputs[0].papers"
     - Parallel Step:
       - Type: Prompt
       - Template: "Academic Paper Analyzer"
       - Model: GPT-4
     - Outputs: [analysis1, analysis2, ...]
  
  3. Summary Generation (Prompt)
     - Synthesizes all analyses
     - Input: Previous parallel results
```

### Example 2: Content Processing with Sub-Workflows

```yaml
Workflow: "Content Publishing Pipeline"
Steps:
  1. Content Input (Prompt)
     - Receives raw content
     - Outputs: { "content": "...", "type": "blog" }
  
  2. Content Processing (Sub-Workflow)
     - Sub-Workflow: "Blog Content Processor"
     - Input Mapping:
       - content: "$.outputs[0].content"
       - target_audience: "\"general\""
     - Outputs: { "processed_content": "..." }
  
  3. Publication (Tool Call)
     - Publishes processed content
     - Uses output from sub-workflow
```

### Example 3: Multi-Model Racing

```yaml
Workflow: "Best Response Selection"
Steps:
  1. Query Preparation (Prompt)
     - Prepares the query
     - Outputs: { "models": ["gpt-4", "claude-3", "gemini-pro"] }
  
  2. Model Racing (Parallel)
     - Array Variable: "$.outputs[0].models"
     - Model Variable: "model_id" (uses array item as model)
     - Parallel Step:
       - Type: Custom Prompt
       - Content: "Answer this question: {{query}}"
     - Outputs: [response1, response2, response3]
  
  3. Best Response Selection (Prompt)
     - Evaluates all responses
     - Selects the best one
```

## Best Practices

### Parallel Execution Best Practices

1. **Array Size Considerations**
   - Monitor resource usage with large arrays
   - Consider breaking very large arrays into chunks
   - Test with representative data sizes

2. **Error Handling**
   - Design workflows to handle partial failures gracefully
   - Use transform steps to filter successful results
   - Implement fallback strategies

3. **Model Selection**
   - Use appropriate models for parallel tasks
   - Consider cost implications of concurrent execution
   - Test model performance with parallel loads

### Sub-Workflow Best Practices

1. **Modular Design**
   - Keep sub-workflows focused and reusable
   - Design clear input/output contracts
   - Document sub-workflow requirements

2. **Input Mapping**
   - Validate input mappings thoroughly
   - Use descriptive variable names
   - Provide default values where appropriate

3. **Performance Considerations**
   - Monitor sub-workflow execution times
   - Avoid deeply nested sub-workflows
   - Consider timeout implications

## Troubleshooting

### Common Parallel Execution Issues

**Issue**: "Array variable does not contain an array"
- **Solution**: Verify the JSONPath query returns an array
- **Check**: Previous step output structure
- **Debug**: Use transform steps to inspect data

**Issue**: "Some parallel branches failed"
- **Solution**: Check individual branch error messages
- **Check**: Model availability and rate limits
- **Debug**: Test with smaller arrays first

**Issue**: "Parallel execution timeout"
- **Solution**: Increase timeout settings or reduce array size
- **Check**: Network connectivity and model response times
- **Debug**: Monitor individual branch performance

### Common Sub-Workflow Issues

**Issue**: "Sub-workflow template not found"
- **Solution**: Verify the workflow exists and ID is correct
- **Check**: Workflow list in the UI
- **Debug**: Ensure workflow is saved properly

**Issue**: "Input mapping failed"
- **Solution**: Verify JSONPath queries and static values
- **Check**: Parent workflow output structure
- **Debug**: Use transform steps to validate data

**Issue**: "Sub-workflow execution timeout"
- **Solution**: Increase timeout or optimize sub-workflow
- **Check**: Sub-workflow complexity and step count
- **Debug**: Test sub-workflow independently

### Debugging Tips

1. **Use Transform Steps**: Add transform steps to inspect data flow
2. **Start Simple**: Test with minimal configurations first
3. **Check Logs**: Monitor browser console for detailed error messages
4. **Test Independently**: Verify sub-workflows work standalone
5. **Validate Data**: Ensure data types match expectations

## Advanced Patterns

### Nested Parallel Execution

You can create workflows where sub-workflows contain parallel steps:

```yaml
Main Workflow:
  - Sub-Workflow: "Document Processing"
    - Contains parallel step for multi-format conversion
  - Aggregation step for all results
```

### Conditional Sub-Workflows

Use transform steps to conditionally select different sub-workflows:

```yaml
Workflow:
  - Content Analysis (determines content type)
  - Transform Step (maps content type to workflow ID)
  - Sub-Workflow (uses mapped workflow ID)
```

### Parallel Sub-Workflows

Run multiple different sub-workflows in parallel:

```yaml
Workflow:
  - Preparation Step
  - Parallel Execution:
    - Array: ["workflow-1", "workflow-2", "workflow-3"]
    - Each item becomes a sub-workflow template ID
```

## API Reference

### Parallel Step Configuration

```typescript
interface ParallelStepConfig {
  type: "parallel";
  parallelOn: string;           // JSONPath to array
  parallelStep: WorkflowStep;   // Step to execute per item
  parallelModelVar?: string;    // Optional: use item as model ID
}
```

### Sub-Workflow Step Configuration

```typescript
interface SubWorkflowStepConfig {
  type: "sub-workflow";
  subWorkflowTemplateId: string;                    // Workflow template ID
  subWorkflowInputMapping?: Record<string, string>; // Variable mappings
}
```

### Context Variables

#### Parallel Step Context
```typescript
{
  [arrayItemKey]: any;      // The current array item
  branchIndex: number;      // 0, 1, 2, ...
  totalBranches: number;    // Total parallel branches
  // ... plus all previous workflow outputs
}
```

#### Sub-Workflow Context
```typescript
{
  // Mapped variables from parent workflow
  [variableName]: any;
}
```

---

This documentation covers the comprehensive functionality of parallel execution and sub-workflows in LiteChat. For additional support or advanced use cases, refer to the main workflow documentation or community resources.