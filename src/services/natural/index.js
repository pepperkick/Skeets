import natural from 'natural';
import config from 'config';
import debug from 'debug';

const log = debug('eve:service:natural');

let classifer;

natural.BayesClassifier.load(config.get('classifier.path'), null, (error, _classifier) => {
    classifer = _classifier;

    if (error) {
        throw new Error('Unable to load classifier file', error);
    }

    log('Classifiers loaded');
});

export default () => {
    return {
        classify: message => classifer.getClassifications(message),
        train: (text, topic) => {
            classifer.addDocument(text, topic);
            classifer.save(config.get('classifier.path'), () => log('Classifiers saved'));
            classifer.train();
        }
    };
};