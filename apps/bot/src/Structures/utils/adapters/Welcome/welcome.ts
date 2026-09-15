import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, GuildMember, TextChannel } from 'discord.js';
import { Service } from '@sern/handler';
import { welcomeEmojis } from './gif.js';

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

const defaultWelcomeMessages = [
  '👋 Welcome to {guild}, {member}',
  'We hope you find what you\'re looking for and enjoy your stay, {member}.',
  '{member} has just joined the server.',
  'Welcome {member}! We were waiting for you.',
  'Hi {member}! Welcome to our community! Please make yourself at home!',
  "Welcome, {member}! Hopefully you aren't a moose because they're one of the main prey for orca whales 🫎"

];

/**
 *
 * @param member The GuildMember in reference to welcome into the guild.
 * @param guildName The name of the guild the member joined.
 * @param memberCount The amount of members in the guild (not including bots).
 * @param WelcomeChannel The channel to send the welcome canvas to.
 * @description Creates a Welcome Canvas for new members that have been successfully verified.
 
export async function welcomeCreate(
  member: GuildMember,
  guildName: string,
  memberCount: number,
  WelcomeChannel: TextChannel,
  channels: { intro: string; roles: string },
  avatarPosition?: AvatarPosition,
  backgroundUrl?: string
) {
  GlobalFonts.registerFromPath('./src/Structures/utils/adapters/Welcome/fonts/AlfaSlabOne-Regular.ttf', 'alfa-regular');
  GlobalFonts.registerFromPath(
    `./src/Structures/utils/adapters/Welcome/fonts/LobsterTwo-BoldItalic.ttf`,
    'lobster-bolditalic'
  );

  const welcomeCanvas = createCanvas(1024, 500);
  const ctx = welcomeCanvas.getContext('2d');
  ctx.font = '68px "Alfa"';
  ctx.fillStyle = '#f7e3e1';

  const url = 'https://i.imgur.com/RCiKhGl.png';
  await loadImage(url).then(async img => {
    ctx.drawImage(img, 0, 0, 1024, 500);
    ctx.fillText('Welcome!', 475, 150);
    ctx.beginPath();
    ctx.arc(275, 200, 128, 0, Math.PI * 2, true);
    ctx.stroke();
    ctx.fill();
  });

  let canvas = welcomeCanvas;
  ctx.font = `52px "Lobster"`;
  ctx.textAlign = 'center';
  ctx.fillText(member.displayName, 650, 220);
  ctx.font = '38px "Lobster"';
  ctx.fillText(`Member #${memberCount}`, 650, 275);
  ctx.beginPath();
  ctx.arc(275, 200, 128, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();
  let url2 = member.displayAvatarURL() ?? member.user.defaultAvatarURL;
  if (url2.endsWith('webp')) {
    url2 = url2.replace('.webp', '.png');
  }
  await loadImage(`${url2}`).then(img2 => {
    ctx.drawImage(img2, 150, 75, 252, 252);
  });
  let Attachment = [
    new AttachmentBuilder(canvas.toBuffer('image/png'), {
      name: `welcome-${member.id}.png`,
      description: `${member.user.username}'s welcome image`
    })
  ];
  let button = [
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

  const customWelcome = await Service('prisma').botWelcomeMessages.findUnique({
    where: { gID: member.guild.id }
  });
  const welcomeText = option(customWelcome?.messagesArray.length ? customWelcome.messagesArray : defaultWelcomeMessages)
    .replaceAll('{guild}', guildName)
    .replaceAll('{member}', member.toString());
  const content = welcomeText +
    `\n-# You may now go to <#${channels.intro}> to introduce yourself and <#${channels.roles}> to get some roles!`;

  try {
    await WelcomeChannel.send({
      content,
      files: Attachment,
      components: button
    });
  } catch (error) {
    console.log(error);
  }
}
*/
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
  GlobalFonts.registerFromPath(
    './src/Structures/utils/adapters/Welcome/fonts/AlfaSlabOne-Regular.ttf',
    'alfa-regular'
  );
  GlobalFonts.registerFromPath(
    './src/Structures/utils/adapters/Welcome/fonts/LobsterTwo-BoldItalic.ttf',
    'lobster-bolditalic'
  );

  const welcomeCanvas = createCanvas(1024, 500);
  const ctx = welcomeCanvas.getContext('2d');

  const guildSettings = await Service('prisma').welcomeSettings.findUnique({
    where: { gID: member.guild.id },
    select: { avatarPosition: true, backgroundUrl: true }
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

  ctx.font = '36px "Lobster"';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2d4a22';
  ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
  ctx.shadowBlur = 6;
  ctx.font = '36px "Lobster"';
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

  const content =
    option([
      `👋 Welcome to ${guildName}, ${member}`,
      `We hope you find what you're looking for and that you enjoy your stay, ${member}.`,
      `${member} is here to kick ass and chew gum, but ${member} has run out of gum.`,
      `${member} has just joined. Save your bananas.`,
      `It's a bird! It's a plane! Nevermind it's just ${member}.`,
      `${member} has joined the server. Can I get a heal?`,
      `${member} has arrived. The party is over.`,
      `${member} has arrived. The party has started.`,
      `Welcome ${member}! We were waiting for you (͡ ° ͜ʖ ͡ °)`,
      `${member} never gonna let you down, ${member} never gonna give you up.`,
      `Hi ${member}! Welcome to our community! Please make yourself at home!`,
      `Welcome, {member}! Hopefully you aren't a moose because they're one of the main prey for orca whales 🫎`
    ]) +
    `\n-# You may now go to <#${channels.intro}> to introduce yourself and <#${channels.roles}> to get some roles!`;

  try {
    await WelcomeChannel.send({
      content,
      files: Attachment,
      components: button
    });
  } catch (error) {
    console.log(error);
  }
}