function _0x4a4a(){const _0x299fdc=['450056puEGjY','max','143vcGKSE','233471KGJMpm','4566MwkTGL','1795VcMqXg','9JORXsB','126520MvPAIK','268681SSRdrQ','toFixed','random','min','length','90693ChsHFG','312170bakfyq','120Vaulrz'];_0x4a4a=function(){return _0x299fdc;};return _0x4a4a();}(function(_0x4a37be,_0x1bbeb6){const _0x2a7bfe=_0x428d,_0x333037=_0x4a37be();while(!![]){try{const _0x5673a4=-parseInt(_0x2a7bfe(0x183))/0x1+-parseInt(_0x2a7bfe(0x18b))/0x2+parseInt(_0x2a7bfe(0x181))/0x3*(parseInt(_0x2a7bfe(0x182))/0x4)+parseInt(_0x2a7bfe(0x180))/0x5*(parseInt(_0x2a7bfe(0x17f))/0x6)+parseInt(_0x2a7bfe(0x18e))/0x7+parseInt(_0x2a7bfe(0x18a))/0x8*(-parseInt(_0x2a7bfe(0x188))/0x9)+parseInt(_0x2a7bfe(0x189))/0xa*(parseInt(_0x2a7bfe(0x18d))/0xb);if(_0x5673a4===_0x1bbeb6)break;else _0x333037['push'](_0x333037['shift']());}catch(_0x16d06f){_0x333037['push'](_0x333037['shift']());}}}(_0x4a4a,0x27a5f));const numbers=[0x0,0x1,0x2,0x3,0x4,0x5,0x6,0x7,0x8,0x9],MAX_PERCENTAGE=0x5d,MATCH_CHANCE_FREQUENCY=0x2/0xb,RANDOM_DEVIATION_CHANCE=0.2,GENERAL_DEVIATION_CHANCE=0.1,DEVIATION_BASE=0x5a,DEVIATION_RANGE=0x23,RANDOM_FREQUENCY_MIN=0x8,RANDOM_FREQUENCY_RANGE=0x5;function determineBaseChances(_0xccb9d6){const _0x53b8c4=_0x428d,_0x27afa1=numbers[_0x53b8c4(0x187)],_0x13c095=0x64/_0x27afa1;let _0x184280,_0x27ae17;return _0x184280=_0x27ae17=_0x13c095,{'higherChance':_0x184280,'lowerChance':_0x27ae17};}function applyRandomDeviation(_0x30c059,_0x447982,_0x51e293){const _0x3b5881=_0x428d;if(Math[_0x3b5881(0x185)]()<RANDOM_DEVIATION_CHANCE&&_0x51e293>Math[_0x3b5881(0x186)](...numbers)&&_0x51e293<Math[_0x3b5881(0x18c)](...numbers)){const _0xb5a604=Math[_0x3b5881(0x185)]()*0xa;_0x30c059=Math[_0x3b5881(0x186)](_0x30c059+_0xb5a604,MAX_PERCENTAGE),_0x447982=Math['max'](_0x447982-_0xb5a604,0x0);}return{'higherChance':_0x30c059,'lowerChance':_0x447982};}function applyGeneralDeviation(_0x59c175,_0x555470){const _0x280bc4=_0x428d;if(Math[_0x280bc4(0x185)]()<GENERAL_DEVIATION_CHANCE){const _0x39203a=DEVIATION_BASE+Math['random']()*DEVIATION_RANGE;_0x59c175=_0x39203a,_0x555470=MAX_PERCENTAGE-_0x59c175;}return{'higherChance':_0x59c175,'lowerChance':_0x555470};}function determinePercentage(_0x2c4fce){const _0x2f3e35=_0x428d;let {higherChance:_0x2b37bf,lowerChance:_0x5c7847}=determineBaseChances(_0x2c4fce);({higherChance:_0x2b37bf,lowerChance:_0x5c7847}=applyRandomDeviation(_0x2b37bf,_0x5c7847,_0x2c4fce),{higherChance:_0x2b37bf,lowerChance:_0x5c7847}=applyGeneralDeviation(_0x2b37bf,_0x5c7847),_0x2b37bf=Math[_0x2f3e35(0x186)](_0x2b37bf,MAX_PERCENTAGE),_0x5c7847=Math[_0x2f3e35(0x18c)](_0x5c7847,0x0));const _0xe5b312=Math['random']()*RANDOM_FREQUENCY_RANGE+RANDOM_FREQUENCY_MIN,_0x4ab26b=_0x2b37bf*_0xe5b312;let _0x5203c7=_0x5c7847*_0xe5b312;return Math[_0x2f3e35(0x185)]()>=MATCH_CHANCE_FREQUENCY&&(_0x5203c7*=0.1),{'higherChance':_0x2b37bf,'lowerChance':_0x5c7847,'randomFrequency':_0xe5b312,'matches':_0x5203c7,'differs':_0x4ab26b};}function _0x428d(_0x4d79d9,_0xf353cc){const _0x4a4a9e=_0x4a4a();return _0x428d=function(_0x428de6,_0x170233){_0x428de6=_0x428de6-0x17f;let _0x55b6f2=_0x4a4a9e[_0x428de6];return _0x55b6f2;},_0x428d(_0x4d79d9,_0xf353cc);}function determineChances(_0x547944){const _0x593775=_0x428d,{matches:_0x2bdfaf,differs:_0x3a7d2d}=determinePercentage(_0x547944),_0x285c40=_0x2bdfaf+_0x3a7d2d,_0x2a91f4=(_0x2bdfaf/_0x285c40*0x61)[_0x593775(0x184)](0x2),_0x22be04=(_0x3a7d2d/_0x285c40*0x61)[_0x593775(0x184)](0x2);return{'matchesChance':_0x2a91f4,'differsChance':_0x22be04};}export{determineChances};