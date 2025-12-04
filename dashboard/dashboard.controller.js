const mongoose = require('mongoose');

class DashboardController {
    async getWeeklyMetals(req, res) {
        try {
            const Transaction = mongoose.model('Transaction');
            const Tradeable = mongoose.model('Tradeable');
            
            // Get gold and silver IDs
            const gold = await Tradeable.findOne({ name: 'gold' });
            const silver = await Tradeable.findOne({ name: 'silver' });
            
            if (!gold || !silver) {
                return res.status(404).json({ message: 'Tradeables not found' });
            }
            
            const goldId = gold._id;
            const silverId = silver._id;
            
            // Get date from one week ago
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            
            // Aggregate gold transactions
            const goldResult = await Transaction.aggregate([
                {
                    $match: {
                        status: 'Successful',
                        createdAt: { $gte: oneWeekAgo },
                        tradeable: goldId
                    }
                },
                {
                    $group: {
                        _id: '$type',
                        totalAmount: { $sum: '$amount' }
                    }
                }
            ]);
            
            // Aggregate silver transactions
            const silverResult = await Transaction.aggregate([
                {
                    $match: {
                        status: 'Successful',
                        createdAt: { $gte: oneWeekAgo },
                        tradeable: silverId
                    }
                },
                {
                    $group: {
                        _id: '$type',
                        totalAmount: { $sum: '$amount' }
                    }
                }
            ]);
            
            // Process gold results
            const goldBuy = goldResult.find(r => r._id === 'Buy')?.totalAmount || 0;
            const goldSell = goldResult.find(r => r._id === 'Sell')?.totalAmount || 0;
            const goldTotal = goldBuy + goldSell;
            
            // Process silver results
            const silverBuy = silverResult.find(r => r._id === 'Buy')?.totalAmount || 0;
            const silverSell = silverResult.find(r => r._id === 'Sell')?.totalAmount || 0;
            const silverTotal = silverBuy + silverSell;
            
            res.json({
                gold: {
                    buy: {
                        grams: goldBuy.toFixed(3),
                        milligrams: (goldBuy * 1000).toFixed(0)
                    },
                    sell: {
                        grams: goldSell.toFixed(3),
                        milligrams: (goldSell * 1000).toFixed(0)
                    },
                    total: {
                        grams: goldTotal.toFixed(3),
                        milligrams: (goldTotal * 1000).toFixed(0)
                    }
                },
                silver: {
                    buy: {
                        grams: silverBuy.toFixed(3),
                        milligrams: (silverBuy * 1000).toFixed(0)
                    },
                    sell: {
                        grams: silverSell.toFixed(3),
                        milligrams: (silverSell * 1000).toFixed(0)
                    },
                    total: {
                        grams: silverTotal.toFixed(3),
                        milligrams: (silverTotal * 1000).toFixed(0)
                    }
                },
                startDate: oneWeekAgo,
                endDate: new Date()
            });
        } catch (error) {
            console.error('Error getting weekly metals:', error);
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = { DashboardController };
