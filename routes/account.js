const express = require('express');
const { authMiddleware } = require('../middleware');
const { Account, Transaction } = require('../db');
const mongoose = require('mongoose')
const router = express.Router();

router.get('/balance', authMiddleware, async (req, res) => {
    const account = await Account.findOne({
        userId: req.userId
    })

    res.json({
        balance: account.balance
    })

})

router.post('/addBalance', authMiddleware, async (req, res) => {
    const account = await Account.findOne({
        userId: req.userId
    })
    let balance = account.balance
    if (balance >= 2500) {
        res.status(411).json({
            message: "amount more than 2500"
        })
    } else {

        balance += Math.random() * 1000
        await Account.updateOne({ userId: req.userId }, { balance })
    }
    res.status(200).json({
        balance,
        message: `${balance}$ added to your account`
    })
})
router.get('/transactions', authMiddleware, async (req, res) => {
    try {
        const account = await Account.findOne({ userId: req.userId }).populate({
            path: 'transactions',
            populate: {
                path: 'to',
                select: 'firstName lastName' // Only select firstName and lastName
            },
            options: { sort: { timestamp: -1 }, limit: 10 }
        });

        if (!account) throw new Error('Account not found');

        const transactionsWithNames = account.transactions.map(transaction => ({
            _id: transaction._id,
            from: transaction.from,
            to: transaction.to, // Populate the to field directly
            amount: transaction.amount,
            timestamp: transaction.timestamp,
            __v: transaction.__v
        }));

        res.json({ transactions: transactionsWithNames, message: "successful" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/transfer', authMiddleware, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' }
    });

    try {
        const { amount, to } = req.body;
        const senderAccountId = req.userId;
        const receiverAccountId = to;

        // Convert amount to a number
        const transferAmount = Number(amount);

        if (isNaN(transferAmount) || transferAmount <= 0) {
            throw new Error("Invalid transfer amount");
        }

        const [senderAccount, receiverAccount] = await Promise.all([
            Account.findOne({ userId: senderAccountId }).session(session),
            Account.findOne({ userId: receiverAccountId }).session(session)
        ]);

        if (!receiverAccount) {
            throw new Error("Receiver account not found");
        }

        if (!senderAccount || senderAccount.balance < transferAmount) {
            throw new Error("Insufficient balance");
        }

        const oldTotalBalance = senderAccount.balance + receiverAccount.balance;

        senderAccount.balance -= transferAmount;
        receiverAccount.balance += transferAmount;

        // Create a new transaction
        const transaction = new Transaction({
            from: senderAccountId,
            to: receiverAccount.userId,
            amount: transferAmount
        });

        senderAccount.transactions.push(transaction._id);
        receiverAccount.transactions.push(transaction._id);

        await Promise.all([
            senderAccount.save({ session }),
            receiverAccount.save({ session }),
            transaction.save({ session })
        ]);

        const newTotalBalance = senderAccount.balance + receiverAccount.balance;

        if (Math.abs(oldTotalBalance - newTotalBalance) > Number.EPSILON) {
            throw new Error("Consistency check failed: Total balance changed");
        }

        await session.commitTransaction();
        res.json({ message: "Transfer successfully completed" });
    } catch (error) {
        await session.abortTransaction();
        console.error("Transfer error:", error);
        if (error.message === "Receiver account not found" || 
            error.message === "Insufficient balance" ||
            error.message === "Invalid transfer amount") {
            res.status(400).json({ message: error.message });
        } else {
            res.status(500).json({ message: "An error occurred during the transfer", error: error.message });
        }
    } finally {
        session.endSession();
    }
});




module.exports = router;