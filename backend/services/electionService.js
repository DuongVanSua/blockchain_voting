const Election = require('../models/Election');

async function createElection(data) {
  try {
    const election = await Election.create(data);
    return election;
  } catch (error) {
    console.error('Error creating election:', error);
    throw error;
  }
}

async function getElections({ page = 1, limit = 100, status, createdBy }) {
  try {
    const offset = (page - 1) * limit;
    const where = {};

    if (status) {
      where.status = status;
    }

    if (createdBy) {
      where.createdBy = createdBy;
    }

    const { count, rows } = await Election.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      elections: rows,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      }
    };
  } catch (error) {
    console.error('Error getting elections:', error);
    throw error;
  }
}

async function getElection(id) {
  try {
    const election = await Election.findByPk(id);
    return election;
  } catch (error) {
    console.error('Error getting election:', error);
    throw error;
  }
}

async function updateElectionContract(id, contractAddress) {
  try {
    const election = await Election.findByPk(id);
    if (!election) {
      throw new Error('Election not found');
    }

    election.contractAddress = contractAddress;
    await election.save();
    return election;
  } catch (error) {
    console.error('Error updating election contract:', error);
    throw error;
  }
}

async function updateElectionIPFS(id, ipfsHash) {
  try {
    const election = await Election.findByPk(id);
    if (!election) {
      throw new Error('Election not found');
    }

    election.ipfsHash = ipfsHash;
    await election.save();
    return election;
  } catch (error) {
    console.error('Error updating election IPFS:', error);
    throw error;
  }
}

module.exports = {
  createElection,
  getElections,
  getElection,
  updateElectionContract,
  updateElectionIPFS,
};

