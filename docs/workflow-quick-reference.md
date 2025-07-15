# Workflow Quick Reference: Parallel & Sub-Workflow

## Parallel Execution

### When to Use
- Process multiple items simultaneously
- Race different AI models
- Batch operations on arrays

### Configuration
1. **Array Variable**: `$.outputs[0].items`
2. **Parallel Step**: Configure the step to run for each item
3. **Optional Model Variable**: Use array items as model IDs

### Example JSONPath Queries
```javascript
$.outputs[0].documents        // Array from first step
$.initial_step.data_array     // Array from trigger
$.outputs[1].results          // Array from second step
```

### Available in Parallel Steps
- Current array item as template variable
- `branchIndex` (0, 1, 2, ...)
- `totalBranches` (total count)
- All previous workflow outputs

## Sub-Workflows

### When to Use
- Reuse existing workflows
- Modular workflow design
- Complex conditional processing

### Configuration
1. **Select Sub-Workflow**: Choose existing workflow template
2. **Input Mapping**: Map parent data to sub-workflow variables

### Input Mapping Examples
```javascript
// JSONPath queries
"content": "$.outputs[0].text"
"priority": "$.initial_step.urgency"

// Static values
"format": "\"markdown\""
"count": "5"
"enabled": "true"
```

## Quick Setup Guide

### Parallel Step Setup
1. Add new step → Select "Parallel Execution"
2. Set Array Variable (JSONPath to array)
3. Configure the parallel step (type, template, model)
4. Test with small array first

### Sub-Workflow Step Setup
1. Add new step → Select "Sub-Workflow"
2. Choose existing workflow template
3. Map input variables (optional)
4. Test sub-workflow independently first

## Common Patterns

### Multi-Document Processing
```yaml
Step 1: Collect documents → outputs array
Step 2: Parallel analysis → process each document
Step 3: Summarize results → combine all analyses
```

### Model Racing
```yaml
Step 1: Prepare query → outputs model list
Step 2: Parallel execution → use models as array items
Step 3: Select best response → evaluate all results
```

### Modular Processing
```yaml
Step 1: Content input → prepare data
Step 2: Sub-workflow → specialized processing
Step 3: Final output → use sub-workflow results
```

## Troubleshooting Checklist

### Parallel Execution Issues
- [ ] Array variable returns actual array?
- [ ] JSONPath syntax correct?
- [ ] Previous step outputs expected data?
- [ ] Models available and accessible?

### Sub-Workflow Issues
- [ ] Sub-workflow template exists?
- [ ] Template ID correct?
- [ ] Input mappings valid?
- [ ] Sub-workflow works independently?

## Performance Tips

- Start with small arrays for testing
- Monitor resource usage with large parallel executions
- Keep sub-workflows focused and efficient
- Use appropriate models for the task complexity
- Consider timeout implications for complex workflows

## Error Handling

- Parallel steps continue with partial results if some branches fail
- Sub-workflows return errors to parent workflow
- Use transform steps to validate and filter results
- Check browser console for detailed error messages