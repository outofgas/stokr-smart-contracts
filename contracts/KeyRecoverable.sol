pragma solidity 0.4.19;

import "../zeppelin-solidity/contracts/ownership/Ownable.sol";


/// @title KeyRecoverable
/// @author Autogenerated from a Dia UML diagram
contract KeyRecoverable is Ownable {

    address public keyRecoverer;

    /// @dev Log entry on key recoverer changed
    /// @param newKeyRecoverer An Ethereum address
    event KeyRecovererChanged(address newKeyRecoverer);

    /// @dev Log entry on key recovered
    /// @param oldAddress An Ethereum address
    /// @param newAddress An Ethereum address
    event KeyRecovered(address oldAddress, address newAddress);

    /// @dev Ensure only key recoverer
    modifier onlyKeyRecoverer() {
        require(msg.sender == keyRecoverer);
        _;
    }

    /// @dev Constructor
    /// @param _keyRecoverer An Ethereum address
    function KeyRecoverable(address _keyRecoverer) public {
        setKeyRecoverer(_keyRecoverer);

    }

    /// @dev Set key recoverer
    /// @param _keyRecoverer An Ethereum address
    function setKeyRecoverer(address _keyRecoverer) public onlyOwner {
        require(_keyRecoverer != address(0));
        keyRecoverer = _keyRecoverer;
        KeyRecovererChanged(_keyRecoverer);

    }

    /// @dev Recover key
    /// @param _oldAddress An Ethereum address
    /// @param _newAddress An Ethereum address
    function recoverKey(address _oldAddress, address _newAddress) public;

}
