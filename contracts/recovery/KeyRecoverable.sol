pragma solidity 0.4.24;

import "../ownership/Ownable.sol";


/// @title KeyRecoverable
/// @author Autogenerated from a Dia UML diagram
contract KeyRecoverable is Ownable {

    address public keyRecoverer;

    /// @dev Log entry on key recoverer changed
    /// @param newKeyRecoverer An Ethereum address
    event KeyRecovererChange(address indexed newKeyRecoverer);

    /// @dev Log entry on key recovered
    /// @param oldAddress An Ethereum address
    /// @param newAddress An Ethereum address
    event KeyRecovery(address indexed oldAddress, address indexed newAddress);

    /// @dev Ensure only key recoverer:w
    modifier onlyKeyRecoverer() {
        require(msg.sender == keyRecoverer, "Restricted to key recoverer");
        _;
    }

    /// @dev Constructor
    /// @param _keyRecoverer An Ethereum address
    constructor(address _keyRecoverer) public {
        setKeyRecoverer(_keyRecoverer);
    }

    /// @dev Set key recoverer
    /// @param _newKeyRecoverer An Ethereum address
    function setKeyRecoverer(address _newKeyRecoverer) public onlyOwner {
        require(_newKeyRecoverer != address(0x0), "New key recoverer is zero");

        if (keyRecoverer != address(0x0) && _newKeyRecoverer != keyRecoverer) {
            emit KeyRecovererChange(_newKeyRecoverer);
        }
        keyRecoverer = _newKeyRecoverer;
    }

    /// @dev Recover key
    /// @param _oldAddress An Ethereum address
    /// @param _newAddress An Ethereum address
    function recoverKey(address _oldAddress, address _newAddress) public;

}
