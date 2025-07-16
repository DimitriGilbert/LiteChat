# Workflow Examples: Parallel & Sub-Workflow

This document provides practical, ready-to-use examples of workflows utilizing parallel execution and sub-workflows.

## Example 1: Multi-Document Research Analysis

**Scenario**: Analyze multiple research papers and generate a comprehensive summary.

### Workflow Configuration

```json
{
  "name": "Research Paper Analysis Pipeline",
  "description": "Analyzes multiple research papers in parallel and generates insights",
  "steps": [
    {
      "id": "paper_collection",
      "name": "Collect Research Papers",
      "type": "custom-prompt",
      "promptContent": "I need to analyze research papers on {{topic}}. Please provide a list of 3-5 key papers with their abstracts.\n\nFormat your response as JSON:\n{\n  \"papers\": [\n    {\n      \"title\": \"Paper Title\",\n      \"abstract\": \"Abstract text...\",\n      \"authors\": \"Author names\"\n    }\n  ]\n}",
      "promptVariables": [
        {
          "name": "topic",
          "description": "Research topic to analyze"
        }
      ]
    },
    {
      "id": "parallel_analysis",
      "name": "Analyze Papers in Parallel",
      "type": "parallel",
      "parallelOn": "$.outputs[0].papers",
      "parallelStep": {
        "id": "individual_analysis",
        "name": "Individual Paper Analysis",
        "type": "custom-prompt",
        "promptContent": "Analyze this research paper:\n\nTitle: {{title}}\nAuthors: {{authors}}\nAbstract: {{abstract}}\n\nProvide:\n1. Key findings\n2. Methodology\n3. Significance\n4. Limitations\n\nFormat as JSON:\n{\n  \"key_findings\": \"...\",\n  \"methodology\": \"...\",\n  \"significance\": \"...\",\n  \"limitations\": \"...\"\n}",
        "modelId": "gpt-4"
      }
    },
    {
      "id": "synthesis",
      "name": "Synthesize Research Insights",
      "type": "custom-prompt",
      "promptContent": "Based on the analysis of multiple research papers, create a comprehensive research summary.\n\nPaper Analyses: {{analyses}}\n\nProvide:\n1. Common themes across papers\n2. Conflicting findings\n3. Research gaps identified\n4. Future research directions\n5. Practical implications\n\nFormat as a well-structured research summary.",
      "promptVariables": [
        {
          "name": "analyses",
          "description": "Results from parallel paper analysis"
        }
      ]
    }
  ]
}
```

### Usage
1. Start workflow with research topic (e.g., "machine learning in healthcare")
2. System collects relevant papers
3. Each paper is analyzed in parallel
4. Final synthesis combines all insights

## Example 2: Content Localization Pipeline

**Scenario**: Translate and adapt content for multiple markets using sub-workflows.

### Main Workflow

```json
{
  "name": "Content Localization Pipeline",
  "description": "Localizes content for multiple markets using specialized sub-workflows",
  "steps": [
    {
      "id": "content_preparation",
      "name": "Prepare Source Content",
      "type": "custom-prompt",
      "promptContent": "Prepare the following content for localization:\n\n{{source_content}}\n\nAnalyze and provide:\n1. Content type (blog, marketing, technical, etc.)\n2. Target markets needed\n3. Cultural considerations\n4. Technical requirements\n\nFormat as JSON:\n{\n  \"content_type\": \"...\",\n  \"target_markets\": [\"US\", \"EU\", \"APAC\"],\n  \"cultural_notes\": \"...\",\n  \"technical_notes\": \"...\",\n  \"prepared_content\": \"cleaned content here\"\n}",
      "promptVariables": [
        {
          "name": "source_content",
          "description": "Original content to localize"
        }
      ]
    },
    {
      "id": "parallel_localization",
      "name": "Localize for Each Market",
      "type": "parallel",
      "parallelOn": "$.outputs[0].target_markets",
      "parallelStep": {
        "id": "market_localization",
        "name": "Market-Specific Localization",
        "type": "sub-workflow",
        "subWorkflowTemplateId": "market-localization-workflow",
        "subWorkflowInputMapping": {
          "content": "$.outputs[0].prepared_content",
          "market": "market",
          "content_type": "$.outputs[0].content_type",
          "cultural_notes": "$.outputs[0].cultural_notes"
        }
      }
    },
    {
      "id": "quality_review",
      "name": "Quality Review",
      "type": "custom-prompt",
      "promptContent": "Review the localized content for consistency and quality:\n\nLocalized Versions: {{localized_content}}\n\nCheck for:\n1. Consistency across markets\n2. Cultural appropriateness\n3. Technical accuracy\n4. Brand voice maintenance\n\nProvide quality score and recommendations for each market.",
      "promptVariables": [
        {
          "name": "localized_content",
          "description": "Results from parallel localization"
        }
      ]
    }
  ]
}
```

### Sub-Workflow: Market Localization

```json
{
  "name": "Market Localization Workflow",
  "description": "Specialized workflow for localizing content to specific markets",
  "steps": [
    {
      "id": "cultural_adaptation",
      "name": "Cultural Adaptation",
      "type": "custom-prompt",
      "promptContent": "Adapt this content for the {{market}} market:\n\nContent: {{content}}\nContent Type: {{content_type}}\nCultural Notes: {{cultural_notes}}\n\nAdapt for:\n1. Cultural preferences\n2. Local regulations\n3. Market-specific terminology\n4. Communication style\n\nProvide adapted content maintaining original intent.",
      "promptVariables": [
        {
          "name": "content",
          "description": "Content to adapt"
        },
        {
          "name": "market",
          "description": "Target market"
        },
        {
          "name": "content_type",
          "description": "Type of content"
        },
        {
          "name": "cultural_notes",
          "description": "Cultural considerations"
        }
      ]
    },
    {
      "id": "language_optimization",
      "name": "Language Optimization",
      "type": "custom-prompt",
      "promptContent": "Optimize the language for {{market}} market:\n\nAdapted Content: {{adapted_content}}\n\nOptimize for:\n1. Local language preferences\n2. Reading level\n3. Technical terminology\n4. SEO considerations (if applicable)\n\nProvide final optimized content.",
      "promptVariables": [
        {
          "name": "adapted_content",
          "description": "Culturally adapted content"
        },
        {
          "name": "market",
          "description": "Target market"
        }
      ]
    }
  ]
}
```

## Example 3: AI Model Performance Comparison

**Scenario**: Compare multiple AI models on the same task to find the best performer.

### Workflow Configuration

```json
{
  "name": "AI Model Performance Comparison",
  "description": "Tests multiple AI models on the same task and compares results",
  "steps": [
    {
      "id": "test_setup",
      "name": "Setup Performance Test",
      "type": "custom-prompt",
      "promptContent": "Setup a performance test for AI models.\n\nTask: {{test_task}}\nEvaluation Criteria: {{criteria}}\n\nProvide:\n1. List of models to test\n2. Standardized test prompt\n3. Evaluation rubric\n\nFormat as JSON:\n{\n  \"models\": [\"gpt-4\", \"claude-3-sonnet\", \"gemini-pro\"],\n  \"test_prompt\": \"standardized prompt here\",\n  \"evaluation_rubric\": {\n    \"accuracy\": \"...\",\n    \"creativity\": \"...\",\n    \"efficiency\": \"...\"\n  }\n}",
      "promptVariables": [
        {
          "name": "test_task",
          "description": "Task to test models on"
        },
        {
          "name": "criteria",
          "description": "Evaluation criteria"
        }
      ]
    },
    {
      "id": "model_racing",
      "name": "Run Models in Parallel",
      "type": "parallel",
      "parallelOn": "$.outputs[0].models",
      "parallelModelVar": "model_id",
      "parallelStep": {
        "id": "model_test",
        "name": "Individual Model Test",
        "type": "custom-prompt",
        "promptContent": "{{test_prompt}}\n\n[This will be executed by each model]",
        "promptVariables": [
          {
            "name": "test_prompt",
            "description": "Standardized test prompt"
          }
        ]
      }
    },
    {
      "id": "performance_evaluation",
      "name": "Evaluate Model Performance",
      "type": "custom-prompt",
      "promptContent": "Evaluate the performance of different AI models:\n\nTest Results: {{model_results}}\nEvaluation Rubric: {{evaluation_rubric}}\nModels Tested: {{models}}\n\nFor each model, provide:\n1. Performance score (1-10)\n2. Strengths\n3. Weaknesses\n4. Best use cases\n\nRank models by overall performance and provide recommendations.",
      "promptVariables": [
        {
          "name": "model_results",
          "description": "Results from parallel model testing"
        },
        {
          "name": "evaluation_rubric",
          "description": "Evaluation criteria"
        },
        {
          "name": "models",
          "description": "List of tested models"
        }
      ]
    }
  ]
}
```

## Example 4: Complex Data Processing Pipeline

**Scenario**: Process complex datasets through multiple specialized sub-workflows.

### Main Workflow

```json
{
  "name": "Complex Data Processing Pipeline",
  "description": "Processes complex datasets through specialized sub-workflows",
  "steps": [
    {
      "id": "data_classification",
      "name": "Classify Data Types",
      "type": "custom-prompt",
      "promptContent": "Analyze the provided dataset and classify data types:\n\nDataset: {{raw_data}}\n\nClassify into:\n1. Structured data (tables, CSV, etc.)\n2. Unstructured text\n3. Media files\n4. Time series data\n\nFor each type found, specify:\n- Processing requirements\n- Recommended sub-workflow\n- Priority level\n\nFormat as JSON with processing plan.",
      "promptVariables": [
        {
          "name": "raw_data",
          "description": "Raw dataset to process"
        }
      ]
    },
    {
      "id": "parallel_processing",
      "name": "Process Data Types in Parallel",
      "type": "parallel",
      "parallelOn": "$.outputs[0].data_types",
      "parallelStep": {
        "id": "specialized_processing",
        "name": "Specialized Data Processing",
        "type": "sub-workflow",
        "subWorkflowTemplateId": "data-type-processor",
        "subWorkflowInputMapping": {
          "data_type": "type",
          "data_content": "content",
          "processing_requirements": "requirements",
          "priority": "priority"
        }
      }
    },
    {
      "id": "results_integration",
      "name": "Integrate Processing Results",
      "type": "custom-prompt",
      "promptContent": "Integrate results from specialized data processing:\n\nProcessing Results: {{processing_results}}\n\nCreate:\n1. Unified data summary\n2. Quality assessment\n3. Insights and patterns\n4. Recommendations for next steps\n\nProvide comprehensive analysis report.",
      "promptVariables": [
        {
          "name": "processing_results",
          "description": "Results from parallel processing"
        }
      ]
    }
  ]
}
```

## Usage Tips for Examples

### Getting Started
1. **Copy the JSON configurations** into LiteChat's workflow builder
2. **Customize the prompts** for your specific use case
3. **Test with small datasets** first
4. **Monitor performance** and adjust as needed

### Customization Points
- **Prompt content**: Adapt to your specific domain
- **Model selection**: Choose appropriate models for your tasks
- **Variable names**: Use descriptive names for clarity
- **Array structures**: Ensure your data matches expected formats

### Performance Considerations
- **Start small**: Test with 2-3 items before scaling up
- **Monitor costs**: Parallel execution can increase API usage
- **Timeout settings**: Adjust for complex processing tasks
- **Error handling**: Plan for partial failures in parallel steps

### Best Practices
- **Modular design**: Keep sub-workflows focused and reusable
- **Clear documentation**: Document your custom workflows
- **Version control**: Save different versions for testing
- **Quality gates**: Include validation steps in your workflows

These examples demonstrate the power and flexibility of LiteChat's parallel execution and sub-workflow capabilities. Adapt them to your specific needs and use cases!