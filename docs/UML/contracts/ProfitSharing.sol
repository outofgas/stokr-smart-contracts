pragma solidity 0.4.19;

import "Ownable.sol";
import "ERC20.sol";


/// @title ProfitSharing
/// @author Autogenerated from a Dia UML diagram
contract ProfitSharing is Ownable, ERC20 {

    struct InvestorAccount {
        uint balance;
        uint lastTotalProfits;
        uint profitShare;
    }

    mapping(address => InvestorAccount) public accounts;
    uint public totalProfits;
    uint internal totalSuppy_;

    /// @dev Log entry on profit deposited
    /// @param depositor An Ethereum address
    /// @param amount A positive number
    event ProfitDeposited(address depositor, uint amount);

    /// @dev Log entry on profit share updated
    /// @param investor An Ethereum address
    /// @param amount A positive number
    event ProfitShareUpdated(address investor, uint amount);

    /// @dev Log entry on profit withdrawal
    /// @param investor An Ethereum address
    /// @param amount A positive number
    event ProfitWithdrawal(address investor, uint amount);

    /// @dev Deposit profit
    function depositProfit() public payable {
        require(IMPLEMENTATION);
    }

    /// @dev Profit share owing
    /// @param _investor An Ethereum address
    /// @return A positive number
    function profitShareOwing(address _investor) public view returns (uint) {
        require(IMPLEMENTATION);
    }

    /// @dev Update profit share
    /// @param _investor An Ethereum address
    function updateProfitShare(address _investor) public {
        require(IMPLEMENTATION);
    }

    /// @dev Withdraw profit share
    function withdrawProfitShare() public {
        require(IMPLEMENTATION);
    }

}

