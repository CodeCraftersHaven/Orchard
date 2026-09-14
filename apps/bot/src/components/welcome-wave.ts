import { sticker } from '#utils';
import { commandModule, CommandType } from '@sern/handler';

export default commandModule({
    type: CommandType.Button,
    name: 'welcome-wave',
    description: 'Sends a sticker to the user who joined the server.',
    async execute(i, t) {
        await i.deferUpdate();
        await sticker(i as unknown as Parameters<typeof sticker>[0], t.params!);
    }
})