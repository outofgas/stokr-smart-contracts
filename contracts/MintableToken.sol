pragma solidity 0.4.19;

import "./ProfitSharing.sol";
import "./Whitelisted.sol";


/// @title MintableToken
/// @author Autogenerated from a Dia UML diagram
/// @dev A mintable token is a token that can be minted
contract MintableToken is ProfitSharing, Whitelisted {

    address public minter;
    bool public mintingFinished;

    /// @dev Log entry on mint
    /// @param to An Ethereum address
    /// @param amount A positive number
    event Minted(address to, uint amount);

    /// @dev Log entry on mint finished
    event MintFinished();

    /// @dev Ensure only minter
    modifier onlyMinter() {
        require(msg.sender == minter);
        _;
    }

    /// @dev Ensure can mint
    modifier canMint() {
        require(!mintingFinished);
        _;
    }

    /// @dev Ensure not minting
    modifier notMinting() {
        require(mintingFinished);
        _;
    }

    /// @dev Set minter
    /// @param _minter An Ethereum address
    function setMinter(address _minter) public onlyOwner {
        require(_minter != address(0));
        require(minter == address(0));

        minter = _minter;
    }

    /// @dev Mint
    /// @param _to An Ethereum address
    /// @param _amount A positive number
    function mint(address _to, uint _amount) public onlyMinter canMint onlyWhitelisted(_to) {
        totalSupply = totalSupply.add(_amount);
        accounts[_to].balance = accounts[_to].balance.add(_amount);

        Minted(_to, _amount);

        Transfer(address(0), _to, _amount);
    }

    /// @dev Finish minting
    function finishMinting() public onlyMinter canMint {
        mintingFinished = true;

        MintFinished();
    }

}
