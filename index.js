// ┌————————————————————— Table of Contents —————————————————————┐
// │ 0. Modules and packages                                     │
// │ 1. Redis, sessions                                          │
// │ 2. Triggers                                                 │
// │ 3. Workers                                                  │
// └—————————————————————————————————————————————————————————————┘

// --------------------------------------------------------------------------
// 0. Modules and packages
// --------------------------------------------------------------------------
require('dotenv').config() // store secrets here
const settings = require('./settings.json') // public settings here

// Bot
const { Telegraf, Markup, Telegram } = require('telegraf')
const bot = new Telegraf(process.env.BOT_TOKEN)
const telegram = new Telegram(process.env.BOT_TOKEN)

// QIWI
const { Wallet } = require("qiwi-sdk");
const wallet = new Wallet({
  token: process.env.QIWI_TOKEN,
  walletId: process.env.QIWI_WALLET_NUMBER
});


// Misc
const date = require('./lib/date.js');
const util = require('./lib/util.js')

// --------------------------------------------------------------------------
// 1. Redis, sessions
// --------------------------------------------------------------------------
const RedisSession = require('telegraf-session-redis')
const sessionInstance = new RedisSession();
const SESSIONS = require('./lib/sessions.js')
bot.use(
  SESSIONS.GLOBAL_SESSION
)
// Global session is used to store data about everything in one place.
// globalSession.users is an Object which contains information about 
// existing users and their purchases. Key is telegram ID of according user.
// Typical user is an object itself and looks like follows:
// {
//   transactions: [], - array of succesfull transactions.
//   paidTill: 0, - timestamp in seconds
//   videosAvailable: [] - array of purchased videos
// }


// --------------------------------------------------------------------------
// 2. Triggers
// --------------------------------------------------------------------------

// ---
// Command /start
//
// Behaviour: Greets new user and propose to subscribe or buy a video with
// 2 different messages
bot.command('start', async (ctx) => {
  util.log(ctx);
  if (ctx.chat.id > 0) {
    // Create user if doesn't exist
    if (!ctx.globalSession.users[ctx.from.id]) {
      ctx.globalSession.users[ctx.from.id] = util.newUserObject();
    }

    // Start of subscription message
    const messageSubscription = `Подписка на аналитику и торговые сигналы - ${settings.subscription.days} дней за ${settings.subscription.price}₽.\n`
    const urlSub = util.createPaymentURL(wallet, ctx.from.id, 'subscription');
    await ctx.reply(messageSubscription, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.url(`Оплата подписки на аналитику и сигналы`, urlSub)
      ])
    })
    // End of subscription message

    // Start of videos message
    let videos = [];
    let counter = 1;
    let messageVideos = `Видео обучение для начинающих:`
    settings.videos.forEach((videoData, id) => {
      if (!ctx.globalSession.users[ctx.from.id].videosAvailable.includes(videoData.telegramID)) {
        videos.push({
          url: util.createPaymentURL(wallet, ctx.from.id, 'video', id),
          text: videoData.buttonText
        })
        messageVideos += `\n${videoData.description} - цена ${videoData.price}₽.`
        counter++;
      }
    })

    if (counter === 1) messageVideos += `\nВсе видео уже приобретены!`
    if (counter < settings.videos.length + 1) messageVideos += `\n\nВидео доступно после оплаты по команде /info`
    let vidsButtons = [];
    videos.forEach(v => {
      vidsButtons.push(Markup.button.url(v.text, v.url))
    })

    await ctx.reply(messageVideos, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(vidsButtons)
    })
    // End of videos message
  } else {
    ctx.reply('Меня можно использовать только в личных сообщениях')
  }
})

// ---
// Command /info
//
// Behaviour: Sends 2 messages with info about current subscription and purchased videos.
bot.command('info', async (ctx) => {
  util.log(ctx);
  if (ctx.chat.id > 0) {
    // Create user if doesn't exist
    if (!ctx.globalSession.users[ctx.from.id]) {
      ctx.globalSession.users[ctx.from.id] = util.newUserObject();
    }
    let userInfo = ctx.globalSession.users[ctx.from.id];

    // Start of subscription message
    let messageSubscription = 'Подписка на аналитику и сигналы\n'
    if (userInfo.paidTill > date.getCurrent().timestamp) {
      messageSubscription += `Активна до ${date.getByTimestamp(userInfo.paidTill).string.testDeadline}`;
    } else {
      messageSubscription += `Активной подписки нет. Стоимость - ${settings.subscription.price}₽ за ${settings.subscription.days} дней`;
    }
    const urlSub = util.createPaymentURL(wallet, ctx.from.id, 'subscription');
    await ctx.reply(messageSubscription, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.url(`Оплата подписки на аналитику и сигналы`, urlSub)
      ])
    })
    // End of subscription message

    // Start of videos message
    let messageVideos = 'Обучение'
    let vidsButtons = [];

    if (userInfo.videosAvailable.length > 0) {
      userInfo.videosAvailable.forEach((v, id) => {
        let idToUse = -1;
        settings.videos.forEach((sv, sid) => {
          if (sv.telegramID === v) idToUse = sid;
        })
        messageVideos += `\n${id + 1}. ${settings.videos[idToUse].description}`
        vidsButtons.push(Markup.button.callback(settings.videos[idToUse].buttonText, `sendvideo-${idToUse}`));
      })
    } else {
      messageVideos += '\n\nДоступных видео нет.'
    }

    messageVideos += '\n\nПриобрести видео можно по команде /start'

    await ctx.reply(messageVideos, {
      parse_mode: 'HTML',
      ...Markup
        .inlineKeyboard(vidsButtons)
        .oneTime()
    })
    // End of videos message
  } else {
    ctx.reply('Меня можно использовать только в личных сообщениях')
  }
})


// ---
// Action sendvideo
//
// Behaviour: send requested video if a user has an access to it.
bot.action(/sendvideo/, async ctx => {
  util.log(ctx);
  const videoID = ctx.callbackQuery.data.split('-')[1];
  const videoTelegramID = settings.videos[videoID].telegramID;

  if (ctx.globalSession.users[ctx.from.id].videosAvailable.includes(videoTelegramID)) {
    ctx.replyWithVideo(videoTelegramID, {
      caption: settings.videos[videoID].description
    })
  } else {
    ctx.reply('Странно, но у тебя нет доступа к этому видео.')
  }
})


// Uncomment this block to receive video's id for settings
/*bot.on('video', (ctx) => {
  if (settings.admins.includes(ctx.from.id)) {
    if (ctx.message.video)  {
      ctx.replyWithHTML(`ID присланного видео: <b>${ctx.message.video.file_id}</b>`, {
        reply_to_message_id: ctx.message.message_id
      })
    } else {
      ctx.reply('У этого видео нет ID 🤔', {
        reply_to_message_id: ctx.message.message_id
      })
    }
  }
})*/


// ---
// General trigger for any received message
//
// Behaviour: If a message received from an admin - forward it to all
// existing users and notify the sender about it. Otherwise ignore.
bot.on('message', (ctx) => {
  if (ctx.chat.id > 0 && settings.admins.includes(ctx.from.id)) {
    let message = 'Успешно переслал это сообщение <b>'
    let counter = 0;
    for (const [userID, userInfo] of Object.entries(ctx.globalSession.users)) {
      if (userInfo.paidTill > date.getCurrent().timestamp) {
        if (userID != ctx.from.id) {
          ctx.forwardMessage(userID)
          counter++;
        }
      }
    }
    message += `${counter}</b> подписчикам.`
    ctx.replyWithHTML(message, {
      reply_to_message_id: ctx.message.message_id
    });
  }
})


// --------------------------------------------------------------------------
// 3. Workers
// --------------------------------------------------------------------------


// ----
// Checks 10 last received payments.
// 
// Add relevant purchases to the 'global' session.
//
// If it's a subscription - push important information
// to the user's archive and update 'paidTill' field.
//
// If it's a video purchase - add purchased video to the
// according field.
// 
// Triggers every: 60 seconds
async function checkPayments() {
  while (true) {
    // Get session from redis
    let globalSessionCopy;
    await sessionInstance.getSession('global').then(session => {
      globalSessionCopy = session;
    })
    if (!globalSessionCopy.users) globalSessionCopy.users = {}; // If info doesn't exist - create it.

    // Get data from the qiwi wallet
    const { data } = await wallet.paymentHistory.getHistory({
      operation: Wallet.TransactionType.IN,
      rows: 10
    });

    data.forEach(async (transaction) => {
      const transactionIsValid = transaction.comment && transaction.txnId;

      if (transactionIsValid) {
        const purchaseType = transaction.comment.includes('-') ? 'video' : 'subscription'
        const userID = transaction.comment.includes('-') ? transaction.comment.split('-')[0] : transaction.comment;

        if (transaction.status === 'SUCCESS' && transactionIsValid && transaction.sum.currency == 643) {

          // create user if doesn't exist
          if (!globalSessionCopy.users[userID]) {
            globalSessionCopy.users[userID] = util.newUserObject();
          }

          switch (purchaseType) {
            case 'subscription':
              let exists = false;
              globalSessionCopy.users[userID].transactions.forEach(prevTrans => {
                if (prevTrans.transactionID === transaction.txnId) {
                  exists = true;
                }
              })

              if (!exists && transaction.sum.amount === settings.subscription.price) {
                const currentTimestamp = date.getCurrent().timestamp;
                let paidTill = currentTimestamp + settings.subscription.days * 24 * 60 * 60;

                // but if user tried to prepay the subscription, just add days to the already existing
                if (currentTimestamp < globalSessionCopy.users[userID].paidTill) {
                  paidTill = globalSessionCopy.users[userID].paidTill + settings.subscription.days * 24 * 60 * 60;
                }

                globalSessionCopy.users[userID].transactions.push({
                  transactionID: transaction.txnId,
                  amount: transaction.sum.amount,
                  timestamp: currentTimestamp
                })
                globalSessionCopy.users[userID].paidTill = paidTill;
                globalSessionCopy.users[userID].notified = [false, false, false];

                await telegram.sendMessage(
                  userID,
                  `Оплата на аналитику и сделки прошла успешно.\n\nИнформация о текущей подписке доступна по команде /info`,
                  { parse_mode: 'HTML' }
                );
              }
              break;
            case 'video':
              const videoNumber = transaction.comment.split('-video')[1];
              const videoID = settings.videos[videoNumber].telegramID;
              const alreadyGotVideo = globalSessionCopy.users[userID].videosAvailable.includes(videoID);

              if (!alreadyGotVideo && transaction.sum.amount === settings.videos[videoNumber].price) {
                globalSessionCopy.users[userID].videosAvailable.push(videoID)
                await telegram.sendMessage(
                  userID,
                  `Видео успешно оплачено.\n\nТы можешь посмотреть оплаченные видео по команде /info`,
                  { parse_mode: 'HTML' }
                );
              }
          }
        }
      }
    })

    await sessionInstance.saveSession('global', globalSessionCopy);

    await util.sleep(60000);
  }
}


// ----
// Checks current subscriptions.
// 
// Send warnings 5 and 3 days before subscription expires.
// Send final warning upon subscription expiration.
//
// All messages have buttons with offer to buy a subscription.
// 
// Triggers every: 60 seconds
async function checkSubscriptions() {
  while (true) {
    let currentTimestamp = date.getCurrent().timestamp;
    let globalSessionCopy;
    await sessionInstance.getSession('global').then(session => {
      globalSessionCopy = session;
    })

    if (!globalSessionCopy.users) globalSessionCopy.users = {};

    for (const [userID, userInfo] of Object.entries(globalSessionCopy.users)) {
      let message = '';

      // 5 days beforehand
      if ((currentTimestamp + 5 * 24 * 60 * 60 > userInfo.paidTill) && !userInfo.notified[0]) {
        message += 'Осталось пять дней до завершения подписки.';
        globalSessionCopy.users[userID].notified[0] = true;
      }

      // 3 days beforehand
      if ((currentTimestamp + 3 * 24 * 60 * 60 > userInfo.paidTill) && !userInfo.notified[1]) {
        message += 'Осталось три дня до завершения подписки.';
        globalSessionCopy.users[userID].notified[1] = true;
      }

      // final
      if ((currentTimestamp > userInfo.paidTill) && !userInfo.notified[2]) {
        message += 'Подписка окончена. Ты не сможешь получать сообщения до её продления.';
        globalSessionCopy.users[userID].notified[2] = true;
      }

      if (message.length > 1) {
        message += `\nПодписка на аналитику и торговые сигналы - ${settings.subscription.days} дней за ${settings.subscription.price}₽.`
        const url = util.createPaymentURL(wallet, userID, 'subscription');
        await telegram.sendMessage(
          userID,
          message,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              Markup.button.url(`Оплата подписки на аналитику и сигналы`, url)
            ])
          }
        );
      }
    }

    await sessionInstance.saveSession('global', globalSessionCopy);

    await util.sleep(60000);
  }
}

checkPayments();
checkSubscriptions();

bot.launch()
// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
