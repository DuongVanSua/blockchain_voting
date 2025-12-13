const fs = require('fs');
const path = require('path');

// Copy ABI files from artifacts to frontend and backend
function copyABI() {
  const artifactsDir = path.join(__dirname, '..', 'artifacts', 'contracts');
  const frontendAbiDir = path.join(__dirname, '..', '..', 'frontend', 'src', 'abi');
  const backendAbiDir = path.join(__dirname, '..', '..', 'backend', 'abi');

  const contracts = ['VotingToken', 'VoterRegistry', 'Election', 'ElectionFactory'];

  // Create directories if they don't exist
  if (!fs.existsSync(frontendAbiDir)) {
    fs.mkdirSync(frontendAbiDir, { recursive: true });
  }
  if (!fs.existsSync(backendAbiDir)) {
    fs.mkdirSync(backendAbiDir, { recursive: true });
  }

  contracts.forEach(contractName => {
    const artifactPath = path.join(artifactsDir, `${contractName}.sol`, `${contractName}.json`);
    
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      const abi = artifact.abi;

      // Copy to frontend
      const frontendAbiPath = path.join(frontendAbiDir, `${contractName}.json`);
      fs.writeFileSync(frontendAbiPath, JSON.stringify(abi, null, 2));
      console.log(`[SUCCESS] Copied ${contractName} ABI to frontend`);

      // Copy to backend
      const backendAbiPath = path.join(backendAbiDir, `${contractName}.json`);
      fs.writeFileSync(backendAbiPath, JSON.stringify(abi, null, 2));
      console.log(`[SUCCESS] Copied ${contractName} ABI to backend`);
    } else {
      console.warn(`[WARNING] Artifact not found for ${contractName}`);
    }
  });

  console.log('\n[SUCCESS] ABI files copied successfully!');
}

copyABI();

