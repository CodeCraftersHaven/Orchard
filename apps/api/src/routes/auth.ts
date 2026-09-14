import axios from 'axios';
import crypto from 'crypto';
import { type FastifyInstance } from 'fastify';
import { env } from '@orchard/config';

export default async function authRoutes(fastify: FastifyInstance) {
  const generateFingerprint = (userAgent: string, ip: string) => {
    return crypto.createHash('sha256').update(userAgent + ip + env.JWT_SECRET).digest('hex');
  };

  fastify.get('/discord/login', async (request, reply) => {
    const scope = ['identify', 'guilds'].join(' ');
    const redirectUri = env.DISCORD_REDIRECT_URI;
    const clientId = env.DISCORD_CLIENT_ID;

    const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;

    return reply.redirect(url);
  });

  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('pomona_session', {
      path: '/',
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax'
    });
    return { success: true, message: 'Logged out successfully' };
  });

  fastify.get('/me', { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.id }
    });

    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    return user;
  });

  fastify.get('/discord/callback', async (request, reply) => {
    const { code } = request.query as { code: string };

    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.DISCORD_REDIRECT_URI,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const discordAccessToken = tokenResponse.data.access_token as string;

    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${discordAccessToken}` }
    });

    const discordUser = userResponse.data;


    await fastify.prisma.user.upsert({
      where: { id: discordUser.id },
      update: { username: discordUser.username, avatar: discordUser.avatar },
      create: { id: discordUser.id, username: discordUser.username, avatar: discordUser.avatar }
    });

    const fingerprint = generateFingerprint(
      request.headers['user-agent'] || '',
      request.ip
    );

    const token = fastify.jwt.sign({
      id: discordUser.id as string,
      username: discordUser.username as string,
      globalName: discordUser.global_name as string | null,
      avatar: discordUser.avatar as string | null,
      fingerprint,
      accessToken: discordAccessToken,
      refreshToken: tokenResponse.data.refresh_token as string
    });

    reply.setCookie('pomona_session', token, {
      path: '/',
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 1
    });

    const dashboardBaseUrl = env.BASE_URL.replace(/\/$/, '');

    return reply.redirect(`${dashboardBaseUrl}/login/callback#token=${token}`);
  });

  fastify.get("/invite", async (request, reply) => {
    const { guild_id } = request.query as { guild_id: string };
    const clientId = env.DISCORD_CLIENT_ID;
    const redirectUri = encodeURIComponent(env.DISCORD_REDIRECT_URI);
    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&scope=bot&permissions=8&guild_id=${guild_id}&disable_guild_select=true&redirect_uri=${redirectUri}&response_type=code`;
    return reply.redirect(inviteUrl);
  });
}