import { Telegraf, session } from 'telegraf';
import { code } from 'telegraf/format'
import { message } from 'telegraf/filters'
import config from 'config'
import { ogg } from './ogg.js';
import { openai } from './openai.js';

const INITIAL_SESSION = {
    messages: [],
}

const bot = new Telegraf(config.get('TELEGRAM_TOKEN'));

bot.use(session());

bot.command('new', async (ctx) => {
    ctx.session = INITIAL_SESSION;
    await ctx.reply('Waiting for your voice message');
})

bot.command('start', async(ctx) => {
    ctx.session = INITIAL_SESSION;
    await ctx.reply('Waiting for your voice message');
})

bot.on(message('voice'), async (ctx) => {
    ctx.session = ctx.session ? ctx.session : INITIAL_SESSION;
    try {
        await ctx.reply(code('Wait for a response from the server...'));
        const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);

        const userId = String(ctx.message.from.id);
        const oggPath = await ogg.create(link.href, userId);
        const mp3Path = await ogg.toMp3(oggPath, userId);

        const text = await openai.transcription(mp3Path);
        await ctx.reply(code(`Your request: ${text}`));

        ctx.session.messages.push({role: openai.roles.USER, content: text});
        const response = await openai.chat(ctx.session.messages);
        ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content});

        await ctx.reply(response.content);
    } catch (e) {
        console.log('Error while voice message', e.message);
    }
})

bot.command('start', async (ctx) => {
    await ctx.reply(JSON.stringify(ctx.message, null, 2));
})

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
