const fs = require("fs")

if (process.argv.length < 3) {
  console.error("Usage: node generate-report.js <results.json>")
  process.exit(1)
}

const resultsFile = process.argv[2]
const results = JSON.parse(fs.readFileSync(resultsFile, "utf8"))

// Extract metrics
const metrics = results.metrics

function formatDuration(ms) {
  return `${ms.toFixed(2)}ms`
}

function formatRate(rate) {
  return `${(rate * 100).toFixed(2)}%`
}

console.log(`# Performance Test Report

## Summary
- **Test Duration**: ${Math.round(results.state.testRunDurationMs / 1000)}s
- **Virtual Users**: ${results.state.isRunning ? "Running" : "Completed"}
- **Total Requests**: ${metrics.http_reqs.values.count}
- **Failed Requests**: ${metrics.http_req_failed.values.passes}

## Response Times
- **Average**: ${formatDuration(metrics.http_req_duration.values.avg)}
- **95th Percentile**: ${formatDuration(metrics.http_req_duration.values["p(95)"])}
- **99th Percentile**: ${formatDuration(metrics.http_req_duration.values["p(99)"])}

## Error Rates
- **HTTP Errors**: ${formatRate(metrics.http_req_failed.values.rate)}
- **Custom Errors**: ${formatRate(metrics.errors?.values.rate || 0)}

## Thresholds
${Object.entries(results.thresholds || {})
  .map(([name, threshold]) => `- **${name}**: ${threshold.ok ? "✅ PASS" : "❌ FAIL"}`)
  .join("\n")}

## Recommendations
${
  metrics.http_req_duration.values["p(95)"] > 500
    ? "- ⚠️ 95th percentile response time exceeds 500ms threshold"
    : "- ✅ Response times are within acceptable limits"
}
${
  metrics.http_req_failed.values.rate > 0.1
    ? "- ⚠️ Error rate exceeds 10% threshold"
    : "- ✅ Error rate is within acceptable limits"
}
`)
