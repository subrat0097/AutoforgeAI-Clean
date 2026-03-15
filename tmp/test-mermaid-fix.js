function parseMermaidDiagram(rawOutput) {
  // First check if the output itself is a valid mermaid graph
  const trimmed = rawOutput.trim();
  if (trimmed.startsWith("graph")) {
    // Check for hallucinations even in trimmed output
    return trimmed.replace(/(class\s+[^ \n,]+(?:,[^ \n,]+)*\s+)classDef\s+/g, "$1");
  }

  // Try ```mermaid or just ``` fenced block
  const fencedRegex = /```(?:mermaid)?\s*\n?([\s\S]*?)```/i;
  const fenced = fencedRegex.exec(rawOutput);
  if (fenced) {
    const content = fenced[1].trim();
    if (content.startsWith("graph") || content.startsWith("pie") || content.startsWith("sequenceDiagram") || content.startsWith("classDiagram") || content.startsWith("stateDiagram") || content.startsWith("gantt") || content.startsWith("journey") || content.startsWith("gitGraph") || content.startsWith("erDiagram")) {
      return content.replace(/(class\s+[^ \n,]+(?:,[^ \n,]+)*\s+)classDef\s+/g, "$1");
    }
  }

  // Fallback: try to find graph TD / graph LR pattern and strip any backticks
  const graphRegex = /(graph\s+(?:TD|LR|BT|RL)[\s\S]*)/i;
  const graph = graphRegex.exec(rawOutput);
  let result = "";
  
  if (graph) {
    result = graph[1].replace(/```/g, "").trim();
  } else {
    result = rawOutput.replace(/```/g, "").trim();
  }

  // Cleanup: LLM often hallucinations 'class J,K classDef db' instead of 'class J,K db'
  // We need to strip 'classDef ' if it follows 'class ...'
  return result.replace(/(class\s+[^ \n,]+(?:,[^ \n,]+)*\s+)classDef\s+/g, "$1");
}

const testCases = [
  {
    name: "Standard correct syntax",
    input: "graph TD\n  A --> B\n  class A frontend",
    expected: "graph TD\n  A --> B\n  class A frontend"
  },
  {
    name: "One hallucinated classDef",
    input: "graph TD\n  A --> B\n  class A classDef frontend",
    expected: "graph TD\n  A --> B\n  class A frontend"
  },
  {
    name: "Multiple nodes with hallucinated classDef",
    input: "graph TD\n  A --> B\n  class A,B classDef frontend",
    expected: "graph TD\n  A --> B\n  class A,B frontend"
  },
  {
    name: "Hallucination at bottom of diagram",
    input: "graph TD\n  A --> B\n  class J,K classDef db\n  class L classDef external",
    expected: "graph TD\n  A --> B\n  class J,K db\n  class L external"
  }
];

console.log("Running Mermaid Parser Tests...");
let failed = 0;

testCases.forEach(tc => {
  const result = parseMermaidDiagram(tc.input);
  if (result === tc.expected) {
    console.log(`✅ [PASS] ${tc.name}`);
  } else {
    console.log(`❌ [FAIL] ${tc.name}`);
    console.log(`   Expected: ${JSON.stringify(tc.expected)}`);
    console.log(`   Got:      ${JSON.stringify(result)}`);
    failed++;
  }
});

if (failed === 0) {
  console.log("\nAll tests passed! 🎉");
  process.exit(0);
} else {
  console.log(`\n${failed} tests failed.`);
  process.exit(1);
}
