"use strict";

const Whitelist = artifacts.require("./Whitelist.sol");
const StokrToken = artifacts.require("./StokrToken.sol");
const StokrCrowdsale = artifacts.require("./StokrCrowdsale.sol");

const BN = web3.BigNumber;
const {expect} = require("chai").use(require("chai-bignumber")(BN));
const {random, time, money, reject, snapshot, logGas} = require("./helpers/common");


contract("StokrCrowdsale", ([owner,
                             investor1,
                             investor2,
                             teamAccount,
                             wallet,
                             anyone]) => {

    // Helper function: default deployment parameters
    const defaultParams = () => ({
        tokenCap: new BN("100e18"),
        tokenGoal: new BN("20e18"),
        openingTime: time.now() + time.mins(1),
        closingTime: time.now() + time.mins(2),
        rate: new BN(2),
        teamShare: new BN("2e18"),
        wallet
    });

    // Helper function: deploy StokrCrowdsale (and Whitelist and StokrToken if necessary)
    const deploySale = async params => {
        let $ = defaultParams();

        if (params !== undefined) {
            for (let name in params) {
                $[name] = params[name];
            }
        }
        if (!("token" in $)) {
            let whitelist = await Whitelist.new({from: owner});
            await whitelist.addAdmin(owner, {from: owner});
            await whitelist.addToWhitelist([investor1, investor2], {from: owner});
            $.token = (await StokrToken.new(whitelist.address,
                                            random.address(),
                                            random.address(),
                                            {from: owner})).address;
        }

        return StokrCrowdsale.new($.token,
                                  $.tokenCap,
                                  $.tokenGoal,
                                  $.openingTime,
                                  $.closingTime,
                                  $.rate,
                                  $.teamShare,
                                  $.wallet,
                                  {from: owner});
    };

    let initialState;

    before("save inital state", async () => {
        initialState = await snapshot.new();
    });

    after("revert to inital state", async () => {
        await initialState.revert();
    });

    describe("deployment", () => {

        describe("with invalid parameters", () => {

            it("fails if token address is zero", async () => {
                await reject.deploy(deploySale({token: 0x0}));
            });

            it("fails if another sale is already minting the token", async () => {
                let token = await (await deploySale()).token();
                await reject.deploy(deploySale({token: token.address}));
            });

            it("fails if cap is zero", async () => {
                await reject.deploy(deploySale({tokenCap: 0}));
            });

            it("fails if goal is zero", async () => {
                await reject.deploy(deploySale({tokenGoal: 0}));
            });

            it("fails if goal is not reachable", async () => {
                let {tokenCap, teamShare} = defaultParams();
                let tokenGoal = tokenCap.minus(teamShare).plus(1);
                await reject.deploy(deploySale({tokenGoal}));
            });

            it("fails if openingTime is in the past", async () => {
                let openingTime = time.now() - time.mins(1);
                await reject.deploy(deploySale({openingTime}));
            });

            it("fails if closingTime is before openingTime", async () => {
                let openingTime = defaultParams().openingTime;
                let closingTime = openingTime - time.secs(1);
                await reject.deploy(deploySale({openingTime, closingTime}));
            });

            it("fails if rate is zero", async () => {
                await reject.deploy(deploySale({rate: 0}));
            });

            it("fails if team share exceeds cap", async () => {
                let tokenCap = defaultParams().tokenCap;
                await reject.deploy(deploySale({teamShare: tokenCap.plus(1)}));
            });

            it("fails if wallet address is zero", async () => {
                await reject.deploy(deploySale({wallet: 0x0}));
            });
        });

        describe("with valid parameters", () => {
            let params = defaultParams();
            let sale;

            it("succeeds", async () => {
                params.token = (await StokrToken.new(random.address(),
                                                     random.address(),
                                                     random.address(),
                                                     {from: owner})).address;
                sale = await deploySale(params);
                expect(await web3.eth.getCode(sale.address)).to.be.not.oneOf(["0x", "0x0"]);
            });

            it("sets correct owner", async () => {
                expect(await sale.owner()).to.be.bignumber.equal(owner);
            });

            it("sets correct token address", async () => {
                expect(await sale.token()).to.be.bignumber.equal(params.token);
            });

            it("sets correct cap", async () => {
                expect(await sale.tokenCap()).to.be.bignumber.equal(params.tokenCap);
            });

            it("sets correct goal", async () => {
                expect(await sale.goal()).to.be.bignumber.equal(params.tokenGoal);
            });

            it("sets correct openingTime", async () => {
                expect(await sale.openingTime()).to.be.bignumber.equal(params.openingTime);
            });

            it("sets correct closingTime", async () => {
                expect(await sale.closingTime()).to.be.bignumber.equal(params.closingTime);
            });

            it("sets correct rate", async () => {
                expect(await sale.rate()).to.be.bignumber.equal(params.rate);
            });

            it("sets correct team share", async () => {
                expect(await sale.teamShare()).to.be.bignumber.equal(params.teamShare);
            });

            it("sets correct wallet address", async () => {
                expect(await sale.wallet()).to.be.bignumber.equal(params.wallet);
            });

            it("correctly calculates remaining tokens for sale", async () => {
                expect(await sale.tokenRemaining()).to.be.bignumber.equal(params.tokenCap.minus(params.teamShare));
            });

            it.skip("correctly calculates remaining sale time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.equal(params.closingTime - time.now());
            });
        });
    });

    describe("time independent", () => {
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
        });

        describe("rate change", () => {

            it("by anyone but owner is forbidden", async () => {
                let rate = await sale.rate();
                await reject.tx(sale.setRate(rate.plus(1), {from: anyone}));
                expect(await sale.rate()).to.be.bignumber.equal(rate);
            });

            it("to zero is forbidden", async () => {
                let rate = await sale.rate();
                await reject.tx(sale.setRate(0, {from: owner}));
                expect(await sale.rate()).to.be.bignumber.equal(rate);
            });

            it("lowering by an order of magnitude is forbidden", async () => {
                let rate = await sale.rate();
                await reject.tx(sale.setRate(rate.divToInt(10), {from: owner}));
                expect(await sale.rate()).to.be.bignumber.equal(rate);
            });

            it("raising by an order of magnitude is forbidden", async () => {
                let rate = await sale.rate();
                await reject.tx(sale.setRate(rate.times(10), {from: owner}));
                expect(await sale.rate()).to.be.bignumber.equal(rate);
            });

            it("is possible", async () => {
                let oldRate = await sale.rate();
                let newRate = oldRate.times(2).plus(1);
                let tx = await sale.setRate(newRate, {from: owner});
                let entry = tx.logs.find(entry => entry.event === "RateChanged");
                expect(entry).to.exist;
                expect(entry.args.oldRate).to.be.bignumber.equal(oldRate);
                expect(entry.args.newRate).to.be.bignumber.equal(newRate);
                expect(await sale.rate()).to.be.bignumber.equal(newRate);
            });
        });

        describe("team account change", () => {

            it("by anyone but owner is forbidden", async () => {
                let teamAccount = await sale.teamAccount();
                await reject.tx(sale.setTeamAccount(teamAccount, {from: anyone}));
                expect(await sale.teamAccount()).to.be.bignumber.equal(teamAccount);
            });

            it("to zero is forbidden", async () => {
                let teamAccount = await sale.teamAccount();
                await reject.tx(sale.setTeamAccount(0x0, {from: owner}));
                expect(await sale.teamAccount()).to.be.bignumber.equal(teamAccount);
            });

            it("is possible", async () => {
                let newTeamAccount = random.address();
                await sale.setTeamAccount(newTeamAccount, {from: owner});
                expect(await sale.teamAccount()).to.be.bignumber.equal(newTeamAccount);
            });
        });

        describe("token distribution", () => {

            it("by anyone is forbidden", async () => {
                let totalSupply = await token.totalSupply();
                await reject.tx(sale.distributeTokens([investor1], [1], {from: anyone}));
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
            });

            it("beyond remaining tokens is forbidden", async () => {
                let totalSupply = await token.totalSupply();
                await reject.tx(sale.distributeTokens([investor1, investor2],
                                                      [await sale.tokenRemaining(), 1],
                                                      {from: owner}));
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply);
            });

            it("is possible", async () => {
                let amount = (await sale.tokenRemaining()).divToInt(2);
                await sale.distributeTokens([investor1], [amount], {from: owner});
            });

            it("increases recipient's balance", async () => {
                let balance = await token.balanceOf(investor1);
                let amount = (await sale.tokenRemaining()).divToInt(2);
                await sale.distributeTokens([investor1], [amount], {from: owner});
                expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance.plus(amount));
            });

            it("increases token total supply", async () => {
                let totalSupply = await token.totalSupply();
                let amount = (await sale.tokenRemaining()).divToInt(2);
                await sale.distributeTokens([investor1], [amount], {from: owner});
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply.plus(amount));
            });

            it("decreases remaining tokens", async () => {
                let remaining = await sale.tokenRemaining();
                let amount = (await sale.tokenRemaining()).divToInt(2);
                await sale.distributeTokens([investor1], [amount], {from: owner});
                expect(await sale.tokenRemaining()).to.be.bignumber.equal(remaining.minus(amount));
            });

            it.skip("many recipients at once is possible", async () => {
                await logGas(sale.distributeTokens([], [], {from: owner}), "no investors");
                let nSucc = 0;
                let nFail = -1;
                let nTest = 1;
                while (nTest != nSucc && nTest < 1024) {
                    let investors = [];
                    let amounts = [];
                    for (let i = 0; i < nTest; ++i) {
                        investors.push(random.address());
                        amounts.push(i);
                    }
                    await whitelist.addToWhitelist(investors, {from: owner});
                    let success = true;
                    try {
                        await logGas(sale.distributeTokens(investors, amounts, {from: owner}), nTest + " investors");
                    }
                    catch (error) {
                        success = false;
                    }
                    if (success) {
                        nSucc = nTest;
                        nTest = nFail < 0 ? 2 * nTest : Math.trunc((nTest + nFail) / 2);
                    }
                    else {
                        nFail = nTest;
                        nTest = Math.trunc((nSucc + nTest) / 2);
                    }
                }
                expect(nSucc).to.be.at.above(2);
            });
        });
    });

    describe("before sale opens", () => {
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
        });

        describe("sale state", () => {

            it("has a non-zero remaining time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.above(0);
            });

            it("is not closed", async () => {
                expect(await sale.hasClosed()).to.be.false;
            });

            it("is not finalized", async () => {
                expect(await sale.isFinalized()).to.be.false;
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let balance = await token.balanceOf(investor1);
                await reject.tx(sale.buyTokens(investor1, {from: investor1, value: money.ether(1)}));
                expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance);
            });
        });

        describe("finalization", () => {

            it("is forbidden", async () => {
                await sale.setTeamAccount(teamAccount, {from: owner});
                await reject.tx(sale.finalize({from: owner}));
                expect(await sale.isFinalized()).to.be.false;
            });
        });
    });

    describe("while sale is open", () => {
        let sale, token, whitelist;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo((await sale.openingTime()).plus(time.secs(1)));
        });

        describe("sale state", () => {

            it("has a non-zero remaining time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.above(0);
            });

            it("is not closed", async () => {
                expect(await sale.hasClosed()).to.be.false;
            });

            it("is not finalized", async () => {
                expect(await sale.isFinalized()).to.be.false;
            });
        });

        describe("token purchase", () => {

            it("by non-whitelisted is forbidden", async () => {
                let balance = await token.balanceOf(anyone);
                await reject.tx(sale.buyTokens(anyone, {from: anyone, value: money.ether(1)}));
                expect(await token.balanceOf(anyone)).to.be.bignumber.equal(balance);
            });

            it("for the benefit of someone else is forbidden", async () => {
                let balance = await token.balanceOf(investor1);
                await reject.tx(sale.buyTokens(investor1, {from: investor2, value: money.ether(1)}));
                expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance);
            });

            it("is possible", async () => {
                let value = money.ether(2);
                let tx = await sale.buyTokens(investor1, {from: investor1, value: value});
                let entry = tx.logs.find(entry => entry.event === "TokenPurchase");
                expect(entry).to.exist;
                expect(entry.args.purchaser).to.be.bignumber.equal(investor1);
                expect(entry.args.beneficiary).to.be.bignumber.equal(investor1);
                expect(entry.args.value).to.be.bignumber.equal(value);
                expect(entry.args.amount).to.be.bignumber.equal(value.times(await sale.rate()));
            });

            it("increases investor's balance", async () => {
                let balance = await token.balanceOf(investor1);
                let value = money.ether(2);
                let amount = value.times(await sale.rate());
                await sale.buyTokens(investor1, {from: investor1, value});
                expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance.plus(amount));
            });

            it("decreases investor's wei balance", async () => {
                let weiBalance = await web3.eth.getBalance(investor1);
                let value = money.ether(2);
                await sale.buyTokens(investor1, {from: investor1, value});
                expect(await web3.eth.getBalance(investor1)).to.be.bignumber.most(weiBalance.minus(value));
            });

            it("increases token total supply", async () => {
                let totalSupply = await token.totalSupply();
                let value = money.ether(2);
                let amount = value.times(await sale.rate());
                await sale.buyTokens(investor1, {from: investor1, value});
                expect(await token.totalSupply()).to.be.bignumber.equal(totalSupply.plus(amount));
            });

            it("decreases remaining tokens", async () => {
                let remaining = await sale.tokenRemaining();
                let value = money.ether(2);
                let amount = value.times(await sale.rate());
                await sale.buyTokens(investor1, {from: investor1, value});
                expect(await sale.tokenRemaining()).to.be.bignumber.equal(remaining.minus(amount));
            });

            it("increases wei raised", async () => {
                let weiRaised = await sale.weiRaised();
                let value = money.ether(2);
                await sale.buyTokens(investor1, {from: investor1, value});
                expect(await sale.weiRaised()).to.be.bignumber.equal(weiRaised.plus(value));
            });

            it("exceeding remaining is forbidden", async () => {
                let remaining = await sale.tokenRemaining();
                let value = remaining.divToInt(await sale.rate()).plus(money.wei(1));
                await reject.tx(sale.buyTokens(investor1, {from: investor1, value}));
                expect(await sale.tokenRemaining()).to.be.bignumber.equal(remaining);
            });
        });

        describe("finalization", () => {

            it("is forbidden", async () => {
                await sale.setTeamAccount(teamAccount, {from: owner});
                await reject.tx(sale.finalize({from: owner}));
                expect(await sale.isFinalized()).to.be.false;
            });
        });
    });

    describe("after sale goal was missed", () => {
        let sale, token, whitelist, investment;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            investment = (await sale.goal()).divToInt(await sale.rate()).minus(money.wei(1));
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo((await sale.openingTime()).plus(time.secs(1)));
            await sale.buyTokens(investor1, {from: investor1, value: investment});
            await time.increaseTo((await sale.closingTime()).plus(time.secs(1)));
        });

        describe("sale state", () => {

            it("has a zero remaining time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.zero;
            });

            it("is closed", async () => {
                expect(await sale.hasClosed()).to.be.true;
            });

            it("goal was missed", async () => {
                expect(await sale.goalReached()).to.be.false;
            });

            it("is not finalized", async () => {
                expect(await sale.isFinalized()).to.be.false;
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let balance = await token.balanceOf(investor1);
                await reject.tx(sale.buyTokens(investor1, {from: investor1, value: money.ether(1)}));
                expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance);
            });

            it("refund is forbidden", async () => {
                let weiBalance = await web3.eth.getBalance(investor1);
                await reject.tx(sale.claimRefund({from: investor1}));
                expect(await web3.eth.getBalance(investor1)).to.be.bignumber.most(weiBalance);
            });
        });

        describe("finalization", () => {

            it("by anyone is forbidden", async () => {
                await reject.tx(sale.finalize({from: anyone}));
                expect(await sale.isFinalized()).to.be.false;
            });

            it("is possible", async () => {
                let tx = await sale.finalize({from: owner});
                let entry = tx.logs.find(entry => entry.event === "Finalized");
                expect(entry).to.exist;
                expect(await sale.isFinalized()).to.be.true;
            });
        });
    });

    describe("after sale goal was reached", () => {
        let sale, token, whitelist, investment;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            investment = (await sale.goal()).divToInt(await sale.rate()).plus(money.wei(1));
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo((await sale.openingTime()).plus(time.secs(1)));
            await sale.buyTokens(investor1, {from: investor1, value: investment});
            await time.increaseTo((await sale.closingTime()).plus(time.secs(1)));
        });

        describe("sale state", () => {

            it("has a zero remaining time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.zero;
            });

            it("is closed", async () => {
                expect(await sale.hasClosed()).to.be.true;
            });

            it("goal was reached", async () => {
                expect(await sale.goalReached()).to.be.true;
            });

            it("is not finalized", async () => {
                expect(await sale.isFinalized()).to.be.false;
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let balance = await token.balanceOf(investor1);
                await reject.tx(sale.buyTokens(investor1, {from: investor1, value: money.ether(1)}));
                expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance);
            });

            it("refund is forbidden", async () => {
                let weiBalance = await web3.eth.getBalance(investor1);
                await reject.tx(sale.claimRefund({from: investor1}));
                expect(await web3.eth.getBalance(investor1)).to.be.bignumber.most(weiBalance);
            });
        });

        describe("finalization", () => {

            it("without team account is forbidden", async () => {
                await reject.tx(sale.finalize({from: owner}));
                expect(await sale.isFinalized()).to.be.false;
            });

            it("without team account being whitelisted is forbidden", async () => {
                await sale.setTeamAccount(teamAccount, {from: owner});
                await reject.tx(sale.finalize({from: owner}));
                expect(await sale.isFinalized()).to.be.false;
            });

            it("by anyone is forbidden", async () => {
                await whitelist.addToWhitelist([teamAccount], {from: owner});
                await reject.tx(sale.finalize({from: anyone}));
                expect(await sale.isFinalized()).to.be.false;
            });

            it("is possible", async () => {
                let tx = await sale.finalize({from: owner});
                let entry = tx.logs.find(entry => entry.event === "Finalized");
                expect(entry).to.exist;
                expect(await sale.isFinalized()).to.be.true;
            });
        });
    });

    describe("after finalization if goal was missed", () => {
        let sale, token, whitelist, investment;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            investment = (await sale.goal()).divToInt(await sale.rate()).minus(money.wei(1));
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo((await sale.openingTime()).plus(time.secs(1)));
            await sale.buyTokens(investor1, {from: investor1, value: investment});
            await time.increaseTo((await sale.closingTime()).plus(time.secs(1)));
            await sale.finalize({from: owner});
        });

        describe("sale state", () => {

            it("has a zero remaining time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.zero;
            });

            it("is closed", async () => {
                expect(await sale.hasClosed()).to.be.true;
            });

            it("goal was missed", async () => {
                expect(await sale.goalReached()).to.be.false;
            });

            it("is not finalized", async () => {
                expect(await sale.isFinalized()).to.be.true;
            });
        });

        describe("token contract", () => {

            it("is destroyed", async () => {
                expect(await web3.eth.getCode(token.address)).to.be.oneOf(["0x", "0x0"]);
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                await reject.tx(sale.buyTokens(investor1, {from: investor1, value: money.ether(1)}));
            });

            it("refund is possible", async () => {
                let weiBalance = await web3.eth.getBalance(investor1);
                await sale.claimRefund({from: investor1});
                expect(await web3.eth.getBalance(investor1)).to.be.bignumber.above(weiBalance);
            });
        });

        describe("finalization", () => {

            it("is forbidden", async () => {
                await reject.tx(sale.finalize({from: owner}));
            });
        });
    });

    describe("after finalization if goal was reached", () => {
        let sale, token, whitelist, investment;

        before("deploy", async () => {
            await initialState.restore();
            sale = await deploySale();
            token = await StokrToken.at(await sale.token());
            whitelist = await Whitelist.at(await token.whitelist());
            investment = (await sale.goal()).divToInt(await sale.rate()).plus(money.wei(1));
            await token.setMinter(sale.address, {from: owner});
            await time.increaseTo((await sale.openingTime()).plus(time.secs(1)));
            await sale.buyTokens(investor1, {from: investor1, value: investment});
            await time.increaseTo((await sale.closingTime()).plus(time.secs(1)));
            await whitelist.addToWhitelist([teamAccount], {from: owner});
            await sale.setTeamAccount(teamAccount, {from: owner});
            await sale.finalize({from: owner});
        });

        describe("sale state", () => {

            it("has a zero remaining time", async () => {
                expect(await sale.timeRemaining()).to.be.bignumber.zero;
            });

            it("is closed", async () => {
                expect(await sale.hasClosed()).to.be.true;
            });

            it("goal was reached", async () => {
                expect(await sale.goalReached()).to.be.true;
            });

            it("is finalized", async () => {
                expect(await sale.isFinalized()).to.be.true;
            });
        });

        describe("token purchase", () => {

            it("is forbidden", async () => {
                let balance = await token.balanceOf(investor1);
                await reject.tx(sale.buyTokens(investor1, {from: investor1, value: money.ether(1)}));
                expect(await token.balanceOf(investor1)).to.be.bignumber.equal(balance);
            });

            it("refund is forbidden", async () => {
                let weiBalance = await web3.eth.getBalance(investor1);
                await reject.tx(sale.claimRefund({from: investor1}));
                expect(await web3.eth.getBalance(investor1)).to.be.bignumber.most(weiBalance);
            });
        });

        describe("team account", () => {

            it("received team share", async () => {
                expect(await token.balanceOf(teamAccount)).to.be.bignumber.equal(await sale.teamShare());
            });
        });

        describe("finalization", () => {

            it("is forbidden", async () => {
                await reject.tx(sale.finalize({from: owner}));
            });
        });
    });

});
