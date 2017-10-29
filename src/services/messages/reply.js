const reply = {
    'chat.greet': [
        'Hello there **<name>**!',
        'Hi **<name>**!',
    ],
};

const colors = {
    normal: {
        red: parseInt('F44336', 16),
        purple: parseInt('9C27B0', 16),
        deep_purple: parseInt('673AB7', 16),
        blue: parseInt('2196F3', 16),
        cyan: parseInt('00BCD4', 16),
        green: parseInt('4CAF50', 16),
        amber: parseInt('FFC107', 16),
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
        getReply: (action) => {
            const replies = reply[action];
            const index = new Date().getTime() % replies.length;

            return replies[index];
        },
        processReply: {
            name: (text, name) => text.replace('<name>', name)
        },
        replyColor: colors
    };
};