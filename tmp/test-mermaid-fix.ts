import { parseMermaidDiagram } from "../lib/parser";

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
