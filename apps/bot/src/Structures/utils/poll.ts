import {
    ActionRowBuilder,
    BaseGuildTextChannel,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ChannelSelectMenuInteraction,
    ChannelType,
    ContainerBuilder,
    EmbedBuilder,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    ModalSubmitInteraction,
    SectionBuilder,
    SeparatorBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
    ThumbnailBuilder,
    User,
} from 'discord.js';

export type PollInteraction = ButtonInteraction | ChannelSelectMenuInteraction | ModalSubmitInteraction | StringSelectMenuInteraction;

type PollFormat = 'embed' | 'container';

type PollDraft = {
    title: string;
    answers: string[];
    emojis: string[];
    color: number;
    footerText: string;
    channelId?: string;
    format: PollFormat;
};

const drafts = new Map<string, PollDraft>();
const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
const maxAnswers = numberEmojis.length;

const pollColors = [
    { label: 'Blurple', value: 'blurple', color: 0x5865f2 },
    { label: 'Green', value: 'green', color: 0x57f287 },
    { label: 'Yellow', value: 'yellow', color: 0xfee75c },
    { label: 'Red', value: 'red', color: 0xed4245 },
    { label: 'Fuchsia', value: 'fuchsia', color: 0xeb459e },
    { label: 'Orange', value: 'orange', color: 0xe67e22 },
    { label: 'Teal', value: 'teal', color: 0x1abc9c },
    { label: 'White', value: 'white', color: 0xffffff },
];

function draftKey(guildId: string, userId: string) {
    return `${guildId}:${userId}`;
}

export function createPollDraft(guildId: string, userId: string): PollDraft {
    const draft: PollDraft = { title: '', answers: [], emojis: [], color: pollColors[0].color, footerText: 'Poll', format: 'embed' };
    drafts.set(draftKey(guildId, userId), draft);
    return draft;
}

function getPollDraft(guildId: string, userId: string) {
    return drafts.get(draftKey(guildId, userId));
}

function deletePollDraft(guildId: string, userId: string) {
    drafts.delete(draftKey(guildId, userId));
}

function colorSelectRow(current: number) {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId('poll-color').setPlaceholder('Choose an embed color').addOptions(
            pollColors.map(entry => ({ label: entry.label, value: entry.value, default: entry.color === current }))
        )
    );
}

function formatSelectRow(current: PollFormat) {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId('poll-format').setPlaceholder('Choose how the poll is posted').addOptions([
            { label: 'Classic embed', value: 'embed', description: 'Posts as a traditional embed message.', default: current === 'embed' },
            { label: 'Components container', value: 'container', description: 'Posts using the same container style as this preview.', default: current === 'container' },
        ])
    );
}

function controlButtonsRow() {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('poll-question').setLabel('Set question').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('poll-answers').setLabel('Set answers').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('poll-emojis').setLabel('Set emojis').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('poll-footer').setLabel('Set footer text').setStyle(ButtonStyle.Secondary),
    );
}

function channelSelectRow(current?: string) {
    return new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder().setCustomId('poll-channel').setPlaceholder('Choose the channel to post in')
            .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setDefaultChannels(current ? [current] : [])
    );
}

function sendButtonsRow(canSend: boolean) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('poll-send').setLabel('Send poll').setStyle(ButtonStyle.Success).setDisabled(!canSend),
        new ButtonBuilder().setCustomId('poll-cancel').setLabel('Discard').setStyle(ButtonStyle.Danger),
    );
}

function canSendDraft(draft: PollDraft) {
    return Boolean(draft.title) && draft.answers.length >= 2 && Boolean(draft.channelId);
}

// Falls back to the default numbered emoji when the creator hasn't set a custom one for that answer.
function resolveEmoji(draft: PollDraft, index: number) {
    return draft.emojis[index]?.trim() || numberEmojis[index];
}

// Renders the poll's actual content (title, answers, footer) onto a container - shared by the live preview and the container send format.
// The container format drops the avatar thumbnail, since it has no embed-style footer icon.
function applyPollContent(container: ContainerBuilder, draft: PollDraft, user: User) {
    const description = draft.answers.length
        ? draft.answers.map((answer, index) => `${resolveEmoji(draft, index)} ${answer}`).join('\n')
        : '*No answers added yet.*';
    container
        .setAccentColor(draft.color)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${draft.title || 'Untitled poll'}`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(description));
    if (draft.format === 'container') {
        return container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${draft.footerText} • ${user.username}`));
    }
    return container.addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${draft.footerText} • ${user.username}`))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ extension: 'png', size: 64 }))));
}

export function buildPollContainer(draft: PollDraft, user: User) {
    const missing = [
        !draft.title && 'a question',
        draft.answers.length < 2 && 'at least 2 answers',
        !draft.channelId && 'a channel',
    ].filter(Boolean) as string[];

    return applyPollContent(new ContainerBuilder(), draft, user)
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('### Build your poll'))
        .addActionRowComponents(colorSelectRow(draft.color))
        .addActionRowComponents(formatSelectRow(draft.format))
        .addActionRowComponents(controlButtonsRow())
        .addActionRowComponents(channelSelectRow(draft.channelId))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(missing.length ? `Missing: ${missing.join(', ')}.` : 'Ready to send!'))
        .addActionRowComponents(sendButtonsRow(canSendDraft(draft)));
}

function questionModal(current: string) {
    return new ModalBuilder().setCustomId('poll-question-submit').setTitle('Poll question').addLabelComponents(
        new LabelBuilder().setLabel('Question').setTextInputComponent(
            new TextInputBuilder().setCustomId('question').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(256).setValue(current).setPlaceholder('What are you choosing on a hot dog?')
        )
    );
}

function answersModal(current: string[]) {
    const field = (index: number) => new LabelBuilder().setLabel(`Answer ${index + 1}${index < 2 ? '' : ' (optional)'}`).setTextInputComponent(
        new TextInputBuilder().setCustomId(`answer-${index}`).setStyle(TextInputStyle.Short).setRequired(index < 2).setMaxLength(150).setValue(current[index] ?? '').setPlaceholder(`Answer ${index + 1}`)
    );
    return new ModalBuilder().setCustomId('poll-answers-submit').setTitle('Poll answers').addLabelComponents(
        ...Array.from({ length: maxAnswers }, (_, index) => field(index))
    );
}

function footerModal(current: string) {
    return new ModalBuilder().setCustomId('poll-footer-submit').setTitle('Poll footer text').addLabelComponents(
        new LabelBuilder().setLabel('Footer text').setTextInputComponent(
            new TextInputBuilder().setCustomId('footer').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100).setValue(current).setPlaceholder('Question of the day')
        )
    );
}

function emojisModal(answers: string[], emojis: string[]) {
    const field = (index: number) => new LabelBuilder().setLabel(`Emoji for "${answers[index].slice(0, 40)}"`).setTextInputComponent(
        new TextInputBuilder().setCustomId(`emoji-${index}`).setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100).setValue(emojis[index] ?? '').setPlaceholder(`Default: ${numberEmojis[index]}`)
    );
    return new ModalBuilder().setCustomId('poll-emojis-submit').setTitle('Poll answer emojis').addLabelComponents(
        ...answers.map((_, index) => field(index))
    );
}

async function sendPoll(interaction: ButtonInteraction, draft: PollDraft) {
    const channel = interaction.guild?.channels.cache.get(draft.channelId ?? '');
    if (!(channel instanceof BaseGuildTextChannel)) return interaction.reply({ content: 'Choose a valid channel before sending.', flags: MessageFlags.Ephemeral });
    const message = draft.format === 'container'
        ? await channel.send({ components: [applyPollContent(new ContainerBuilder(), draft, interaction.user)], flags: MessageFlags.IsComponentsV2 })
        : await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle(draft.title)
                .setDescription(draft.answers.map((answer, index) => `${resolveEmoji(draft, index)} ${answer}`).join('\n'))
                .setColor(draft.color)
                .setFooter({ text: `${draft.footerText} • ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ extension: 'png', size: 64 }) })
                .setTimestamp()],
        });
    for (let index = 0; index < draft.answers.length; index++) await message.react(resolveEmoji(draft, index)).catch(() => undefined);
    deletePollDraft(interaction.guildId!, interaction.user.id);
    return interaction.update({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`✅ Poll sent to <#${channel.id}>.`))], flags: MessageFlags.IsComponentsV2 });
}

export async function handlePollInteraction(interaction: PollInteraction) {
    const draft = getPollDraft(interaction.guildId!, interaction.user.id);
    if (!draft) return interaction.reply({ content: 'This poll builder has expired. Run `/poll` again.', flags: MessageFlags.Ephemeral });

    if (interaction.isStringSelectMenu() && interaction.customId === 'poll-color') {
        const selected = pollColors.find(entry => entry.value === interaction.values[0]);
        if (selected) draft.color = selected.color;
        return interaction.update({ components: [buildPollContainer(draft, interaction.user)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'poll-format') {
        if (interaction.values[0] === 'embed' || interaction.values[0] === 'container') draft.format = interaction.values[0];
        return interaction.update({ components: [buildPollContainer(draft, interaction.user)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isChannelSelectMenu() && interaction.customId === 'poll-channel') {
        draft.channelId = interaction.values[0];
        return interaction.update({ components: [buildPollContainer(draft, interaction.user)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isButton()) {
        if (interaction.customId === 'poll-question') return interaction.showModal(questionModal(draft.title));
        if (interaction.customId === 'poll-answers') return interaction.showModal(answersModal(draft.answers));
        if (interaction.customId === 'poll-emojis') {
            if (!draft.answers.length) return interaction.reply({ content: 'Set your answers before customizing their emojis.', flags: MessageFlags.Ephemeral });
            return interaction.showModal(emojisModal(draft.answers, draft.emojis));
        }
        if (interaction.customId === 'poll-footer') return interaction.showModal(footerModal(draft.footerText));
        if (interaction.customId === 'poll-cancel') {
            deletePollDraft(interaction.guildId!, interaction.user.id);
            return interaction.update({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('Poll discarded.'))], flags: MessageFlags.IsComponentsV2 });
        }
        if (interaction.customId === 'poll-send') {
            if (!canSendDraft(draft)) return interaction.reply({ content: 'Finish the poll before sending it.', flags: MessageFlags.Ephemeral });
            return sendPoll(interaction, draft);
        }
    }
    if (interaction.isModalSubmit() && interaction.isFromMessage() && interaction.customId === 'poll-question-submit') {
        draft.title = interaction.fields.getTextInputValue('question').trim();
        return interaction.update({ components: [buildPollContainer(draft, interaction.user)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isModalSubmit() && interaction.isFromMessage() && interaction.customId === 'poll-answers-submit') {
        const answers = Array.from({ length: maxAnswers }, (_, index) => interaction.fields.getTextInputValue(`answer-${index}`).trim()).filter(Boolean);
        if (answers.length < 2) return interaction.reply({ content: 'Provide at least 2 answers.', flags: MessageFlags.Ephemeral });
        draft.answers = answers;
        draft.emojis = draft.emojis.slice(0, answers.length);
        return interaction.update({ components: [buildPollContainer(draft, interaction.user)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isModalSubmit() && interaction.isFromMessage() && interaction.customId === 'poll-emojis-submit') {
        draft.emojis = draft.answers.map((_, index) => interaction.fields.getTextInputValue(`emoji-${index}`).trim());
        return interaction.update({ components: [buildPollContainer(draft, interaction.user)], flags: MessageFlags.IsComponentsV2 });
    }
    if (interaction.isModalSubmit() && interaction.isFromMessage() && interaction.customId === 'poll-footer-submit') {
        draft.footerText = interaction.fields.getTextInputValue('footer').trim() || 'Poll';
        return interaction.update({ components: [buildPollContainer(draft, interaction.user)], flags: MessageFlags.IsComponentsV2 });
    }
}
