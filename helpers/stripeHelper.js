const subscribtionService = require("../services/subscribtionService");
const userService = require("../services/userService");
const mongoose = require('mongoose');
const dateHelper = require("./dateHelper");
const ObjectId = mongoose.Types.ObjectId;

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const CUSTOMER_TOKEN_PREFIX = 'cus';
const CARD_TOKEN_PREFIX = 'tok';

async function charge(
    sourceCustomerIdOrCardToken,
    sourceAmount,
    transferUserStripeAccountId,
    transferAmount = null, // If null, amount would be consider 100% of sourceAmount
) {
    console.log('sourceCustomerIdOrCardToken...', sourceCustomerIdOrCardToken);
    let splitString = sourceCustomerIdOrCardToken.split('_');
    let customerDetail = {};
    if (splitString[0] == CUSTOMER_TOKEN_PREFIX) {
        customerDetail['customer'] = sourceCustomerIdOrCardToken;
    } else if (splitString[0] == CARD_TOKEN_PREFIX) {
        customerDetail['source'] = sourceCustomerIdOrCardToken;
    }

    //stripe.paymentIntents.create({
    return stripe.charges.create({
        // customer: sourceCustomerId,
        amount: parseInt(sourceAmount),
        currency: process.env.STRIPE_CURRENCY,
        //   source: stripeToken,
        description: 'Video call charge',
        transfer_data: {
            destination: transferUserStripeAccountId,
            amount: transferAmount ? transferAmount : parseInt(sourceAmount),
        },
        ...customerDetail
    }).then((charge) => {
        console.log('charge.....', charge);
        return {
            status: true,
            data: charge,
        }
    })
        .catch((e) => {
            console.log('charge ERROR.....', '' + e);
            return {
                success: false,
                message: '' + e,
            }
        });
}

async function createCustomer(email, source) {
    const customer = await stripe.customers
        .create({
            email: email,
            source: source,
        });

    let customerId = customer.id

    return await userService.updateToAll({
        email: email,
    }, {
        stripeCustomerId: customerId,
    })
}

async function updateSubscriptionPrice(coachUserId, subscriptionPrice) {
    let subscribeDetail = await subscribtionService.aggregate([
        {
            $match: {
                'coachUserID': coachUserId,
                'isActive': true,
            }
        }
    ]);

    await Promise.all(
        subscribeDetail.map(async (e) => {
            const PRODUCT_NAME = 'Monthly Subscription'
            const PRODUCT_TYPE = 'service'

            const product = await stripe.products
                .create({
                    name: PRODUCT_NAME,
                    type: PRODUCT_TYPE,
                })
                .catch((exception) => {
                    return res.status(400).send({
                        success: false,
                        message: '' + exception,
                        statusCode: 400,
                    })
                })

            const PRODUCT_ID = product.id
            const PLAN_INTERVAL = 'month'
            const CURRENCY = process.env.STRIPE_CURRENCY
            const PLAN_PRICE = parseInt(subscriptionPrice) * 100

            const subscription = await stripe.subscriptions.retrieve(e.stripeSubscriptionId);
            const deleted = await stripe.plans.del(
                subscription.items.data[0].plan.id
            );
            const plan = await stripe.plans.create({
                id: subscription.items.data[0].plan.id,
                amount: PLAN_PRICE,
                currency: CURRENCY,
                interval: PLAN_INTERVAL,
                product: PRODUCT_ID,
            });

            const updateData = await stripe.subscriptions
                .update(
                    e.stripeSubscriptionId,
                    {
                        cancel_at_period_end: false,
                        proration_behavior: 'none', //create_prorations
                        items: [
                            {
                                id: subscription.items.data[0].id,
                                price: subscription.items.data[0].plan.id,
                            },
                        ],
                        metadata: {
                            coachUserID: e.coachUserID.toString(),
                            learnerUserID: e.learnerUserID.toString(),
                        },
                    }
                );

                console.log('updateData..', updateData);
        
                await subscribtionService.update(e._id, {
                    subscriptionAmount: subscriptionPrice,
                });
        })
    )
    console.log('learners', subscribeDetail);
}

module.exports = {
    charge: charge,
    createCustomer: createCustomer,
    updateSubscriptionPrice: updateSubscriptionPrice,
}