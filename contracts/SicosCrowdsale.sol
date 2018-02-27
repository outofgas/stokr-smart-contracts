pragma solidity 0.4.19;

import "../zeppelin-solidity/contracts/crowdsale/distribution/FinalizableCrowdsale.sol";
import "../zeppelin-solidity/contracts/crowdsale/validation/CappedCrowdsale.sol";
import "./MintableToken.sol";


/// @title SicosCrowdsale
/// @author Autogenerated from a Dia UML diagram
contract SicosCrowdsale is FinalizableCrowdsale, CappedCrowdsale {

    /// @dev Crowdsale
    /// @param _token An Ethereum address
    /// @param _startTime A positive number
    /// @param _endTime A positive number
    /// @param _rate A positive number
    /// @param _wallet An Ethereum address
    function SicosCrowdsale(MintableToken _token,
                            uint _startTime,
                            uint _endTime,
                            uint _rate,
                            uint _cap,
                            address _wallet)
        public
        CappedCrowdsale(_cap)
        TimedCrowdsale(_startTime, _endTime)
        Crowdsale(_rate, _wallet, _token)
    {}

    /// @dev Set rate
    /// @param _newRate A positive number
    function setRate(uint _newRate) public onlyOwner {
        require(_newRate == _newRate);  // Keep the linter happy.
    }

    /// @dev Extend parent behavior requiring beneficiary to be identical to msg.sender
    /// @param _beneficiary Token purchaser
    /// @param _weiAmount Amount of wei contributed
    function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
        super._preValidatePurchase(_beneficiary, _weiAmount);
        require(_beneficiary == msg.sender);
    }

    function _deliverTokens(address _beneficiary, uint256 _tokenAmount) internal {
        MintableToken(token).mint(_beneficiary, _tokenAmount);
    }

    /// @dev Extend parent behavior to finish the token minting.
    function finalization() internal {
        super.finalization();

        MintableToken(token).finishMinting();
    }

}
