// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VotingToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public owner;
    mapping(address => bool) public minters;

    bool public isTransferable;

    event Transfer(
        address indexed sender,
        address indexed receiver,
        uint256 value
    );

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    event Mint(
        address indexed to,
        uint256 amount
    );

    event Burn(
        address indexed from,
        uint256 amount
    );

    event MinterAdded(
        address indexed minter,
        address indexed addedBy
    );

    event MinterRemoved(
        address indexed minter,
        address indexed removedBy
    );

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        totalSupply = 0;
        owner = msg.sender;
        minters[msg.sender] = true;
        isTransferable = false;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyMinter() {
        require(minters[msg.sender], "Only minters can perform this action");
        _;
    }

    function addMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "Invalid minter address");
        require(!minters[_minter], "Already a minter");
        
        minters[_minter] = true;
        emit MinterAdded(_minter, msg.sender);
    }

    function removeMinter(address _minter) external onlyOwner {
        require(_minter != owner, "Cannot remove owner as minter");
        require(minters[_minter], "Not a minter");
        
        minters[_minter] = false;
        emit MinterRemoved(_minter, msg.sender);
    }

    function mint(address _to, uint256 _amount) external onlyMinter {
        require(_to != address(0), "Cannot mint to zero address");
        require(_amount > 0, "Amount must be greater than 0");
        
        totalSupply += _amount;
        balanceOf[_to] += _amount;
        
        emit Mint(_to, _amount);
        emit Transfer(address(0), _to, _amount);
    }

    function burn(address _from, uint256 _amount) external onlyMinter {
        require(_amount > 0, "Amount must be greater than 0");
        require(balanceOf[_from] >= _amount, "Insufficient balance");
        
        totalSupply -= _amount;
        balanceOf[_from] -= _amount;
        
        emit Burn(_from, _amount);
        emit Transfer(_from, address(0), _amount);
    }

    function transfer(address _to, uint256 _value) external returns (bool) {
        revert("Voting tokens are non-transferable");
    }

    function transferFrom(address _from, address _to, uint256 _value) external returns (bool) {
        revert("Voting tokens are non-transferable");
    }

    function approve(address _spender, uint256 _value) external returns (bool) {
        revert("Approval not allowed for voting tokens");
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid new owner address");
        
        address oldOwner = owner;
        owner = _newOwner;
        minters[_newOwner] = true;
        
        emit OwnershipTransferred(oldOwner, _newOwner);
    }

    function isMinter(address _account) external view returns (bool) {
        return minters[_account];
    }
}

