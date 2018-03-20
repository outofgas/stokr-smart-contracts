pragma solidity 0.4.19;

import "../zeppelin-solidity/contracts/ownership/Ownable.sol";
import "../zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../zeppelin-solidity/contracts/math/SafeMath.sol";


/// @title ProfitSharing
/// @author Autogenerated from a Dia UML diagram
contract ProfitSharing is Ownable, ERC20 {

    using SafeMath for uint;

    struct InvestorAccount {
        uint balance;
        uint lastTotalProfits;
        uint profitShare;
    }

    mapping(address => InvestorAccount) public accounts;
    uint public totalProfits;

    uint internal totalSupply_;

    /// @dev Log entry on profit deposited
    /// @param _depositor An Ethereum address
    /// @param _amount A positive number
    event ProfitDeposited(address _depositor, uint _amount);
    event ProfitShareUpdated(address _investor, uint _amount);
    event ProfitWithdrawal(address _investor, uint _amount);

    /// @dev Deposit profit
    function depositProfit() public payable {
        totalProfits.add(msg.value);

        ProfitDeposited(msg.sender, msg.value);
    }

    /// @dev Profit share owing
    /// @param _investor An Ethereum address
    /// @return A positive number
    function profitShareOwing(address _investor) public view returns (uint) {
        return totalProfits.sub(accounts[_investor].lastTotalProfits)
                           .mul(accounts[_investor].balance)
                           .div(totalSupply_);  // <- The linter doesn't like this.
    }

    /// @dev Update profit share
    /// @param _investor An Ethereum address
    function updateProfitShare(address _investor) public {
        uint additionalProfitShare =  profitShareOwing(_investor);

        accounts[_investor].lastTotalProfits = totalProfits;
        accounts[_investor].profitShare = accounts[_investor].profitShare.add(additionalProfitShare);

        ProfitShareUpdated(_investor, additionalProfitShare);

    }

    function withdrawProfitShare() public {
        updateProfitShare(msg.sender);

        uint withdrawnProfitShare = accounts[msg.sender].profitShare;

        accounts[msg.sender].profitShare = 0;
        msg.sender.transfer(withdrawnProfitShare);

        ProfitWithdrawal(msg.sender, withdrawnProfitShare);
    }

}
