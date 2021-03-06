pragma solidity 0.4.24;

import "./ownership/Ownable.sol";
import "./whitelist/Whitelist.sol";
import "./token/StokrToken.sol";
import "./token/StokrTokenFactory.sol";
import "./crowdsale/StokrCrowdsale.sol";
import "./crowdsale/StokrCrowdsaleFactory.sol";
import "./crowdsale/RateSourceInterface.sol";


contract StokrProjectManager is Ownable, RateSource {

    // Project structure
    struct StokrProject {
        string name;
        Whitelist whitelist;
        StokrToken token;
        StokrCrowdsale crowdsale;
    }


    // Block number where this contract instance was deployed
    uint public deploymentBlockNumber;

    // Ethereum address of the Ether prize setting authority
    address public rateAdmin;

    // Current price of an Ether in EUR cents
    uint private rate;

    // Current whitelist and token factory and crowdsale factory instances
    Whitelist public currentWhitelist;
    StokrTokenFactory public tokenFactory;
    StokrCrowdsaleFactory public crowdsaleFactory;

    // List of projects
    StokrProject[] public projects;


    /// @dev Log entry upon rate change event
    /// @param previous Previous rate in EUR cent per Ether
    /// @param current Current rate in EUR cent per Ether
    event RateChange(uint previous, uint current);

    /// @dev Log entry upon rate admin change event
    /// @param previous Ethereum address of previous rate admin
    /// @param current Ethereum address of current rate admin
    event RateAdminChange(address previous, address current);


    /// @dev Restrict operation to rate admin role
    modifier onlyRateAdmin() {
        require(msg.sender == rateAdmin, "Restricted to rate admin");
        _;
    }


    /// @dev Constructor
    /// @param etherRate Initial price of an Ether in EUR cents
    constructor(uint etherRate) public {
        require(etherRate > 0, "Ether rate is zero");

        deploymentBlockNumber = block.number;
        rate = etherRate;
    }

    /// @dev Set the current whitelist contract instance
    /// @param newWhitelist Whitelist instance
    function setWhitelist(Whitelist newWhitelist) public onlyOwner {
        require(address(newWhitelist) != address(0x0), "Whitelist is zero");

        currentWhitelist = newWhitelist;
    }

    /// @dev Set the current token factory contract instance
    /// @param newTokenFactory StokrTokenFactory instance
    function setTokenFactory(StokrTokenFactory newTokenFactory) public onlyOwner {
        require(address(newTokenFactory) != address(0x0), "Token factory is zero");

        tokenFactory = newTokenFactory;
    }

    /// @dev Set the current crowdsale factory contract instance
    /// @param newCrowdsaleFactory StokrCrowdsaleFactory instance
    function setCrowdsaleFactory(StokrCrowdsaleFactory newCrowdsaleFactory) public onlyOwner {
        require(address(newCrowdsaleFactory) != address(0x0), "Crowdsale factory is zero");

        crowdsaleFactory = newCrowdsaleFactory;
    }

    /// @dev Set rate admin, i.e. the ether rate setting authority
    /// @param newRateAdmin Ethereum address of rate admin
    function setRateAdmin(address newRateAdmin) public onlyOwner {
        require(newRateAdmin != address(0x0), "New rate admin is zero");

        if (newRateAdmin != rateAdmin) {
            emit RateAdminChange(rateAdmin, newRateAdmin);

            rateAdmin = newRateAdmin;
        }
    }

    /// @dev Set rate, i.e. adjust to changes of EUR/ether exchange rate
    /// @param newRate Rate in Euro cent per ether
    function setRate(uint newRate) public onlyRateAdmin {
        // Rate changes beyond an order of magnitude are likely just typos
        require(rate / 10 < newRate && newRate < 10 * rate, "Rate change too big");

        if (newRate != rate) {
            emit RateChange(rate, newRate);

            rate = newRate;
        }
    }

    /// @dev Return the current price of an Ether in EUR cents
    /// @return Current Ether rate
    function etherRate() public view returns (uint) {
        return rate;
    }

    /// @dev Return the number of projects deployed by this instance
    /// @return Projects count
    function projectsCount() public view returns (uint) {
        return projects.length;
    }

    /// @dev Create a new project,
    ///      i.e. deploy a new token and crowdsale and store their address into projects
    function createNewProject(
        string name,
        string symbol,
        uint tokenPrice,
        address[4] roles,  // [profitDepositor, keyRecoverer, tokenOwner, crowdsaleOwner]
        uint[5] amounts,  // [tokenCapOfPublicSale, tokenCapOfPrivateSale, tokenGoal,
                          //  tokenPurchaseMinimum, tokenReservePerMill]
        uint[2] period,  // [openingTime, closingTime]
        address[2] wallets  // [companyWallet, reserveAccount]
    )
        public onlyOwner
    {
        require(address(currentWhitelist) != address(0x0), "Whitelist is zero");
        require(address(tokenFactory) != address(0x0), "Token factory is zero");
        require(address(crowdsaleFactory) != address(0x0), "Crowdsale factory is zero");

        // Parameters are given as arrays to avoid the "stack too deep" complaints of the
        // Solidity compiler.
        // Furthermore the deployment of the tokens and the crowdsale contract is done via
        // factory contracts whose only purpose is to deploy an instance of the respective
        // contract. This construction avoids the problem of limited bytecode length when
        // deploying contracts (see EIP170). As a side effect, it also enables the change
        // of one of the factories by an updated version.

        // Utilize the token factory to deploy a new token contract instance
        StokrToken token = tokenFactory.createNewToken(
            name,
            symbol,
            currentWhitelist,
            roles[0],  // profitDepositor
            roles[1]);  // keyRecoverer

        // Utilize the crowdsale factory to deploy a new crowdsale contract instance
        StokrCrowdsale crowdsale = crowdsaleFactory.createNewCrowdsale(
            token,
            tokenPrice,
            amounts,
            period,
            wallets);

        token.setMinter(crowdsale);  // The crowdsale should be the minter of the token
        token.transferOwnership(roles[2]);  // to tokenOwner
        crowdsale.transferOwnership(roles[3]);  // to crowdsaleOwner

        // Store the created project into the projects array state variable
        projects.push(StokrProject(name, currentWhitelist, token, crowdsale));
    }

}

