import { createCanvas, loadImage } from '@napi-rs/canvas';
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, EmbedBuilder, GuildMember, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, SeparatorBuilder, TextChannel, TextDisplayBuilder, type ColorResolvable } from 'discord.js';
import { Service } from '@sern/handler';
import { lobsterFontFamily, registerCanvasFonts, welcomeEmojis } from '#utils';

export type AvatarPosition = 'left' | 'middle' | 'right';
export const defaultWelcomeBackgroundUrl = 'https://i.imgur.com/RCiKhGl.png';

const loadWelcomeBackground = async (url: string) => {
  try {
    return await loadImage(url);
  } catch {
    return loadImage(defaultWelcomeBackgroundUrl);
  }
};

const option = (array: Array<string>): string => {
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
};

/**
 * @param member The GuildMember in reference to welcome into the guild.
 * @param guildName The name of the guild the member joined.
 * @param memberCount The amount of members in the guild (not including bots).
 * @param WelcomeChannel The channel to send the welcome canvas to.
 * @description Creates a Welcome Canvas for new members that have been successfully verified.
 */
export async function welcomeCreate(
  member: GuildMember,
  guildName: string,
  memberCount: number,
  WelcomeChannel: TextChannel,
  channels: { intro: string; roles: string },
  avatarPosition?: AvatarPosition,
  backgroundUrl?: string
) {
  if (!WelcomeChannel?.isTextBased()) return;
  registerCanvasFonts();

  const welcomeCanvas = createCanvas(1024, 500);
  const ctx = welcomeCanvas.getContext('2d');

  const guildSettings = await Service('prisma').welcomeSettings.findUnique({
    where: { gID: member.guild.id },
    select: { avatarPosition: true, backgroundUrl: true, mode: true, embedTitle: true, embedDescription: true, embedColor: true, embedAuthor: true, embedTimestamp: true, embedFields: true, containerExtraText: true, containerImageUrl: true, containerGalleryUrls: true, containerSeparators: true }
  });
  const resolvedAvatarPosition = avatarPosition ?? (
    guildSettings?.avatarPosition === 'left' || guildSettings?.avatarPosition === 'right'
      ? guildSettings.avatarPosition
      : 'middle'
  );
  const resolvedBackgroundUrl = backgroundUrl || guildSettings?.backgroundUrl || defaultWelcomeBackgroundUrl;

  const bgImg = await loadWelcomeBackground(resolvedBackgroundUrl);
  ctx.drawImage(bgImg, 0, 0, 1024, 500);

  const avatarCenterX = resolvedAvatarPosition === 'left' ? 190 : resolvedAvatarPosition === 'right' ? 834 : 512;
  const avatarCenterY = 250;
  const avatarRadius = 85;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 4, 0, Math.PI * 2, true);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();

  let avatarUrl = member.displayAvatarURL({ extension: 'png', size: 256 }) ?? member.user.defaultAvatarURL;
  if (avatarUrl.endsWith('.webp')) {
    avatarUrl = avatarUrl.replace('.webp', '.png');
  }

  const avatarImg = await loadImage(avatarUrl);
  ctx.drawImage(
    avatarImg,
    avatarCenterX - avatarRadius,
    avatarCenterY - avatarRadius,
    avatarRadius * 2,
    avatarRadius * 2
  );
  ctx.restore();

  ctx.font = `36px "${lobsterFontFamily}"`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2d4a22';
  ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
  ctx.shadowBlur = 6;
  ctx.font = `36px "${lobsterFontFamily}"`;
  ctx.fillText(`Member #${memberCount}`, avatarCenterX, avatarCenterY + avatarRadius + 50);

  ctx.shadowBlur = 0;

  const Attachment = [
    new AttachmentBuilder(welcomeCanvas.toBuffer('image/png'), {
      name: `welcome-${member.id}.png`,
      description: `${member.user.username}'s welcome image`
    })
  ];

  const button = [
    new ActionRowBuilder<ButtonBuilder>({
      components: [
        new ButtonBuilder({
          label: ` Wave to say hi!`,
          emoji: option(welcomeEmojis),
          custom_id: `welcome-wave/${member.id}`,
          style: ButtonStyle.Secondary
        })
      ]
    })
  ];

  const customWelcome = await Service('prisma').botWelcomeMessages.findUnique({ where: { gID: member.guild.id } });
  const welcomeText =
    option(customWelcome?.messagesArray?.length ? customWelcome.messagesArray : [
      `👋 Welcome to {guildName}, {member}`,
      `We hope you find what you're looking for and that you enjoy your stay, {member}.`,
      `{member} is here to kick ass and chew gum, but {member} has run out of gum.`,
      `{member} has just joined. Save your bananas.`,
      `It's a bird! It's a plane! Nevermind it's just {member}.`,
      `{member} has joined the server. Can I get a heal?`,
      `{member} has arrived. The party is over.`,
      `{member} has arrived. The party has started.`,
      `Welcome {member}! We were waiting for you (͡ ° ͜ʖ ͡ °)`,
      `{member} never gonna let you down, {member} never gonna give you up.`,
      `Hi {member}! Welcome to our community! Please make yourself at home!`,
      `Welcome, {member}! Hopefully you aren't a moose because they're one of the main prey for orca whales 🫎`
    ])
      .replaceAll('{guild}', guildName)
      .replaceAll('{member}', member.toString());
  const footer = `\n-# You may now go to <#${channels.intro}> to introduce yourself and <#${channels.roles}> to get some roles!`;
  const content = welcomeText + footer;
  const mode = guildSettings?.mode === 'text' || guildSettings?.mode === 'embed' || guildSettings?.mode === 'container' ? guildSettings.mode : 'image';

  try {
    if (mode === 'text') return void await WelcomeChannel.send({ content, components: button });
    if (mode === 'container') {
      const container = new ContainerBuilder();
      if (guildSettings?.containerSeparators) container.addSeparatorComponents(new SeparatorBuilder());
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
      if (guildSettings?.containerExtraText) {
        if (guildSettings.containerSeparators) container.addSeparatorComponents(new SeparatorBuilder());
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(guildSettings.containerExtraText));
      }
      const galleryUrls = (guildSettings?.containerGalleryUrls || '').split(/\r?\n|,/).map(url => url.trim()).filter(Boolean);
      if (guildSettings?.containerImageUrl || galleryUrls.length) {
        const urls = guildSettings?.containerImageUrl ? [guildSettings.containerImageUrl, ...galleryUrls] : galleryUrls;
        container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(...urls.map(url => new MediaGalleryItemBuilder().setURL(url))));
      }
      container.addActionRowComponents(button[0]);
      return void await WelcomeChannel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
    if (mode === 'embed') {
      const embedColor = guildSettings?.embedColor && /^#[0-9A-Fa-f]{6}$/.test(guildSettings.embedColor)
        ? guildSettings.embedColor as ColorResolvable
        : '#5865F2' as ColorResolvable;
      const embed = new EmbedBuilder()
        .setTitle(guildSettings?.embedTitle || 'Welcome!')
        .setDescription((guildSettings?.embedDescription || welcomeText) + footer)
        .setColor(embedColor);
      if (guildSettings?.embedAuthor) embed.setAuthor({ name: guildSettings.embedAuthor });
      if (guildSettings?.embedTimestamp) embed.setTimestamp();
      try {
        const fields = JSON.parse(guildSettings?.embedFields || '[]');
        if (Array.isArray(fields)) embed.addFields(fields.filter(field => field?.name && field?.value).map(field => ({ name: String(field.name), value: String(field.value), inline: Boolean(field.inline) })));
      } catch { /* Ignore malformed optional fields. */ }
      return void await WelcomeChannel.send({ embeds: [embed], components: button });
    }
    await WelcomeChannel.send({ content, files: Attachment, components: button });
  } catch (error) {
    console.log(error);
  }
}