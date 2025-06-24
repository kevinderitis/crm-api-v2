const Payment = require('../models/payment.model');
const Conversation = require('../models/conversation.model');
const Ticket = require('../models/ticket.model');

exports.getSalesReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Build date filter
        const dateFilter = {};
        if (startDate && endDate) {
            dateFilter.created_at = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // Get new users count (from conversations)
        const newUsersData = await Conversation.aggregate([
            {
                $match: dateFilter
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
                    newUsers: { $addToSet: "$customer_id" }
                }
            },
            {
                $project: {
                    _id: 1,
                    newUsers: { $size: "$newUsers" }
                }
            }
        ]);

        // Get tickets count
        const ticketsData = await Ticket.aggregate([
            {
                $match: dateFilter
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
                    ticketCount: { $sum: 1 }
                }
            }
        ]);

        // Get sales data
        const salesData = await Payment.aggregate([
            {
                $match: {
                    ...dateFilter,
                    status: 'approved'
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
                    netSales: { $sum: "$amount" },
                    bonuses: { $sum: "$bonus" }
                }
            }
        ]);

        // Get prizes data (from completed withdrawal tickets)
        const prizesData = await Ticket.aggregate([
            {
                $match: {
                    ...dateFilter,
                    status: { $in: ['completed', 'edited'] },
                    subject: 'Retiro'
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
                    prizes: { $sum: "$real_amount" }
                }
            }
        ]);

        // Combine all data
        const allDates = new Set([
            ...salesData.map(d => d._id),
            ...ticketsData.map(d => d._id),
            ...newUsersData.map(d => d._id),
            ...prizesData.map(d => d._id)
        ]);

        const combinedData = Array.from(allDates).map(date => {
            const sales = salesData.find(d => d._id === date) || { netSales: 0, bonuses: 0 };
            const tickets = ticketsData.find(d => d._id === date) || { ticketCount: 0 };
            const users = newUsersData.find(d => d._id === date) || { newUsers: 0 };
            const prizes = prizesData.find(d => d._id === date) || { prizes: 0 };

            return {
                date,
                newUsers: users.newUsers,
                ticketCount: tickets.ticketCount,
                netSales: sales.netSales,
                bonuses: sales.bonuses,
                prizes: prizes.prizes,
                totalSales: sales.netSales - prizes.prizes
            };
        }).sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(combinedData);
    } catch (error) {
        console.error('Error getting sales report:', error);
        res.status(500).json({ message: 'Error getting sales report' });
    }
};

exports.getPrizesReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Build date filter
        const dateFilter = {};
        if (startDate && endDate) {
            dateFilter.created_at = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // Get completed tickets with withdrawal amounts
        const prizesData = await Ticket.aggregate([
            {
                $match: {
                    ...dateFilter,
                    status: 'completed',
                    subject: 'Retiro' // Only withdrawal tickets
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'completed_by',
                    foreignField: '_id',
                    as: 'operator'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'created_by',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $project: {
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
                    user: { $arrayElemAt: ["$user.email", 0] },
                    amount: "$real_amount",
                    collection: { $subtract: ["$real_amount", { $multiply: ["$real_amount", 0.05] }] }, // 5% collection fee
                    bonus: { $multiply: ["$real_amount", 0.05] }, // 5% bonus
                    status: "$status",
                    operator: { $arrayElemAt: ["$operator.full_name", 0] }
                }
            },
            { $sort: { date: -1 } }
        ]);

        res.json(prizesData);
    } catch (error) {
        console.error('Error getting prizes report:', error);
        res.status(500).json({ message: 'Error getting prizes report' });
    }
};