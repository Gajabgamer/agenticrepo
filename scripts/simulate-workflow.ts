import 'dotenv/config';
import { runLocalWorkflowSimulation } from '@/lib/testing/localWorkflowExecution';

async function main() {
  const result = await runLocalWorkflowSimulation();

  console.log(JSON.stringify({
    stage: 'simulation.summary',
    status: 'success',
    message: 'Workflow simulation summary',
    details: result,
    timestamp: new Date().toISOString(),
  }));
}

main().catch((error) => {
  console.error(JSON.stringify({
    stage: 'simulation.summary',
    status: 'error',
    message: error instanceof Error ? error.message : 'Unknown simulation error',
    timestamp: new Date().toISOString(),
  }));
  process.exitCode = 1;
});

// Made with Bob
