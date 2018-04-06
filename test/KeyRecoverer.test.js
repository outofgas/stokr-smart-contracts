"use strict";

const KeyRecoverer = artifacts.require("./KeyRecoverer.sol");

const { expect } = require("chai");
const { should } = require("./helpers/utils");
const { rejectTx } = require("./helpers/tecneos");


contract("KeyRecoverer", ([owner, anyone]) => {
    let keyRecoverer;

    describe("deployment", () => {

        it("should succeed", async () => {
            keyRecoverer = await KeyRecoverer.new({from: owner});
            let code = await web3.eth.getCode(keyRecoverer.address);
            assert(code !== "0x" && code !== "0x0", "contract code is expected to be non-zero");
        });

        it("sets correct owner", async () => {
            let _owner = await keyRecoverer.owner();
            _owner.should.be.bignumber.equal(owner);
        });

    });

});
