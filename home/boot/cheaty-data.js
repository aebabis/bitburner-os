const HACKNET_MONEY = [null, 1, 1, .25, .05, .2, .2, .2, 0, 1, .5, .1, 1/1.02];
    
export const getBitNodeMultipliers = (bitNodeN) => {
    return {
        HacknetNodeMoney: HACKNET_MONEY[bitNodeN],
    };
};