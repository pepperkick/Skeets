import debug from 'debug';

import reply from './reply';

const log = debug('eve:service:reply');

const colors = {
    normal: {
        red: parseInt('F44336', 16),            //Fatal
        purple: parseInt('9C27B0', 16),         //Conversation Groups
        deep_purple: parseInt('673AB7', 16),
        blue: parseInt('2196F3', 16),
        cyan: parseInt('00BCD4', 16),           //Replies
        green: parseInt('4CAF50', 16),          //Info and Success
        amber: parseInt('FFC107', 16),          //Warnings
        orange: parseInt('FF9800', 16),
    },
    dark: {
        red: parseInt('E53935', 16),
        purple: parseInt('8E24AA', 16),
        deep_purple: parseInt('5E35B1', 16),
        blue: parseInt('1E88E5', 16),
        cyan: parseInt('00ACC1', 16),
        green: parseInt('43A047', 16),
        amber: parseInt('FFB300', 16),
        orange: parseInt('FB8C00', 16),
    },
    light: {
        red: parseInt('EF5350', 16),
        purple: parseInt('AB47BC', 16),
        deep_purple: parseInt('7E57C2', 16),
        blue: parseInt('42A5F5', 16),
        cyan: parseInt('26C6DA', 16),
        green: parseInt('66BB6A', 16),
        amber: parseInt('FFCA28', 16),
        orange: parseInt('FFA726', 16),
    }
};

export default () => {
    return {
        getReply: (tag) => {
            const replies = reply[tag];
            const index = new Date().getTime() % replies.length;

            log(`Serving reply for tag ${tag}`);

            return replies[index];
        },
        processReply: {
            name: (text, name) => text.replace('<name>', name)
        },
        replyColor: colors
    };
};