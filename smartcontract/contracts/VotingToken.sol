// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ERC20 Interface
 * @dev Standard ERC-20 token interface
 */
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

/**
 * @title VotingToken
 * @dev ERC-20 compliant voting token that is non-transferable by default
 * This token is used as voting credits in the election system.
 * Tokens can be minted by authorized minters and burned when used for voting.
 * Transfer and approval functions are disabled to prevent vote trading.
 */
contract VotingToken is IERC20 {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 private _totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    address public owner;
    mapping(address => bool) public minters;

    bool public isTransferable; // Owner can enable/disable transfers if needed

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

    event TransferabilityChanged(
        bool isTransferable,
        address indexed changedBy
    );

    constructor(string memory _name, string memory _symbol) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_symbol).length > 0, "Symbol cannot be empty");
        
        name = _name;
        symbol = _symbol;
        _totalSupply = 0;
        owner = msg.sender;
        minters[msg.sender] = true;
        isTransferable = false; // Non-transferable by default for voting integrity
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyMinter() {
        require(minters[msg.sender], "Only minters can perform this action");
        _;
    }

    /**
     * @dev ERC-20: Returns the total supply of tokens
     */
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev ERC-20: Returns the balance of tokens for an account
     */
    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev ERC-20: Transfer tokens (disabled by default for voting integrity)
     * Can be enabled by owner if needed
     */
    function transfer(address _to, uint256 _value) external override returns (bool) {
        require(isTransferable, "Voting tokens are non-transferable");
        require(_to != address(0), "Cannot transfer to zero address");
        require(_balances[msg.sender] >= _value, "Insufficient balance");
        
        _balances[msg.sender] -= _value;
        _balances[_to] += _value;
        
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    /**
     * @dev ERC-20: Transfer tokens from another address (disabled by default)
     * Can be enabled by owner if needed
     */
    function transferFrom(address _from, address _to, uint256 _value) external override returns (bool) {
        require(isTransferable, "Voting tokens are non-transferable");
        require(_from != address(0), "Cannot transfer from zero address");
        require(_to != address(0), "Cannot transfer to zero address");
        require(_balances[_from] >= _value, "Insufficient balance");
        require(_allowances[_from][msg.sender] >= _value, "Insufficient allowance");
        
        _balances[_from] -= _value;
        _balances[_to] += _value;
        _allowances[_from][msg.sender] -= _value;
        
        emit Transfer(_from, _to, _value);
        return true;
    }

    /**
     * @dev ERC-20: Approve spender to transfer tokens (disabled by default)
     * Can be enabled by owner if needed
     */
    function approve(address _spender, uint256 _value) external override returns (bool) {
        require(isTransferable, "Approval not allowed for non-transferable tokens");
        require(_spender != address(0), "Cannot approve zero address");
        
        _allowances[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    /**
     * @dev ERC-20: Returns the amount of tokens that spender is allowed to transfer
     */
    function allowance(address _owner, address _spender) external view override returns (uint256) {
        return _allowances[_owner][_spender];
    }

    /**
     * @dev Owner: Add a new minter address
     */
    function addMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "Invalid minter address");
        require(!minters[_minter], "Already a minter");
        
        minters[_minter] = true;
        emit MinterAdded(_minter, msg.sender);
    }

    /**
     * @dev Owner: Remove a minter address
     */
    function removeMinter(address _minter) external onlyOwner {
        require(_minter != owner, "Cannot remove owner as minter");
        require(minters[_minter], "Not a minter");
        
        minters[_minter] = false;
        emit MinterRemoved(_minter, msg.sender);
    }

    /**
     * @dev Minter: Mint new tokens to an address
     */
    function mint(address _to, uint256 _amount) external onlyMinter {
        require(_to != address(0), "Cannot mint to zero address");
        require(_amount > 0, "Amount must be greater than 0");
        
        _totalSupply += _amount;
        _balances[_to] += _amount;
        
        emit Mint(_to, _amount);
        emit Transfer(address(0), _to, _amount);
    }

    /**
     * @dev Minter: Burn tokens from an address
     */
    function burn(address _from, uint256 _amount) external onlyMinter {
        require(_amount > 0, "Amount must be greater than 0");
        require(_balances[_from] >= _amount, "Insufficient balance");
        
        _totalSupply -= _amount;
        _balances[_from] -= _amount;
        
        emit Burn(_from, _amount);
        emit Transfer(_from, address(0), _amount);
    }

    /**
     * @dev Owner: Enable or disable token transfers
     * @param _isTransferable True to enable transfers, false to disable
     */
    function setTransferable(bool _isTransferable) external onlyOwner {
        isTransferable = _isTransferable;
        emit TransferabilityChanged(_isTransferable, msg.sender);
    }

    /**
     * @dev Owner: Transfer ownership of the contract
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid new owner address");
        
        address oldOwner = owner;
        owner = _newOwner;
        minters[_newOwner] = true;
        
        emit OwnershipTransferred(oldOwner, _newOwner);
    }

    /**
     * @dev Check if an address is a minter
     */
    function isMinter(address _account) external view returns (bool) {
        return minters[_account];
    }
}

