pragma solidity 0.4.24;

import "../node_modules/zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./Whitelist.sol";


/// @title Whitelisted
/// @author Autogenerated from a Dia UML diagram
contract Whitelisted is Ownable {

    Whitelist public whitelist;

    /// @dev Log entry on whitelist changed
    /// @param newWhitelist An Ethereum address
    event WhitelistChanged(address newWhitelist);

    /// @dev Ensure only whitelisted
    modifier onlyWhitelisted(address _address) {
        require(whitelist.isWhitelisted(_address), "Address must be whitelisted.");
        _;
    }

    /// @dev Constructor
    /// @param _whitelist An Ethereum address
    constructor(address _whitelist) public {
        setWhitelist(_whitelist);
    }

    /// @dev Set whitelist
    /// @param _newWhitelist An Ethereum address
    function setWhitelist(address _newWhitelist) public onlyOwner {
        require(_newWhitelist != address(0x0), "Whitelist address must not be zero.");

        if (whitelist != address(0x0) && _newWhitelist != address(whitelist)) {
            emit WhitelistChanged(_newWhitelist);
        }
        whitelist = Whitelist(_newWhitelist);
    }

}

