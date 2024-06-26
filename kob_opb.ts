import axios, { AxiosResponse } from 'axios';
import schedule from 'node-schedule'
import Redis from 'ioredis';

export interface OneplaybetHookDto {
    paymentDatetime: number; // เวลาทำรายการ
    formAccountCodeName: string; // จากธนาคาร X
    formAccountNumber: string; // จากเลขบัญชี
    amount: number; // จำนวนเงิน
    paymentCodeName: string; // ถึงธนาคาร
    paymentAccountNumber: string; // ถึงเลขบัญชี
    oneagentCode: string;
    remark: string;
    channel: string;
    remainingBalance: null | number; // จำนวนเงินคงเหลือ
}

export interface ResponseKobBank {
    id: string;
    bank: string;
    bankcolor: string;
    time: string;
    channel: string;
    value: string;
    detail: string;
    atranferer: string;
    checktime: string;
    tranferer: string;
}

const PAYMENT_CODE_DICTIONARY = {
    "BBLA": "002",
    "KBANK": "004",
    "KTBA": "006",
    "TMB": "011",
    "SCBA": "014",
    "CITI": "017",
    "SCBT": "020",
    "CMBT": "022",
    "UOBT": "024",
    "BAYA": "025",
    "GSBA": "030",
    "GHBA": "033",
    "BAAC": "034",
    "TBNK": "065",
    "ISBT": "066",
    "TSCO": "063",
    "KKBA": "069",
    "ICBC": "070",
    "TCRB": "071",
    "LHBA": "073"
}
// Create a Redis client
// const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: 6379, password: process.env.REDIS_PASSWORD || '' });


export class KobBankAdapter {
    cookie: string;

    constructor() {
        this.cookie = 'kob_session=9k1s953flm59ku7toa2k85mrhn9e9dhg; logon=889f2ed0c0016b935990dec7060187924bd664bbf8dc4a0f485302e7e5cd48b678957fb97b06ef50a0df402caa8d81494cfbf16f8543146cc7315ec0efd892d5gJ9qpadRJmwv6Y31C2Tzf%2FGrjrWIrLYmGTkDj%2BM6SMn%2BIM3JxHe0KpOGk755f7cb'
    }

    private bankData = [
        { "Bank Code": "002", "Bank": "BBLA", "Bank Name": "ธนาคารกรุงเทพ จำกัด (มหาชน)" },
        { "Bank Code": "004", "Bank": "KBANK", "Bank Name": "ธนาคารกสิกรไทย จำกัด (มหาชน)" },
        { "Bank Code": "006", "Bank": "KTBA", "Bank Name": "ธนาคารกรุงไทย จำกัด (มหาชน)" },
        { "Bank Code": "011", "Bank": "TMB", "Bank Name": "ธนาคารทหารไทย จำกัด (มหาชน)" },
        { "Bank Code": "014", "Bank": "SCBA", "Bank Name": "ธนาคารไทยพาณิชย์ จำกัด (มหาชน)" },
        { "Bank Code": "017", "Bank": "CITI", "Bank Name": "ธนาคารซิตี้แบงก์" },
        { "Bank Code": "020", "Bank": "SCBT", "Bank Name": "ธนาคารสแตนดาร์ดชาร์เตอร์ด (ไทย) จำกัด (มหาชน)" },
        { "Bank Code": "022", "Bank": "CMBT", "Bank Name": "ธนาคาร ซีไอเอ็มบี ไทย จำกัด (มหาชน)" },
        { "Bank Code": "024", "Bank": "UOBT", "Bank Name": "ธนาคารยูโอบี จำกัด (มหาชน)" },
        { "Bank Code": "025", "Bank": "BAYA", "Bank Name": "ธนาคารกรุงศรีอยุธยา จำกัด (มหาชน)" },
        { "Bank Code": "030", "Bank": "GSBA", "Bank Name": "ธนาคารออมสิน" },
        { "Bank Code": "033", "Bank": "GHBA", "Bank Name": "ธนาคารอาคารสงเคราะห์" },
        { "Bank Code": "034", "Bank": "BAAC", "Bank Name": "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร" },
        { "Bank Code": "065", "Bank": "TBNK", "Bank Name": "ธนาคารธนชาต จำกัด (มหาชน)" },
        { "Bank Code": "066", "Bank": "ISBT", "Bank Name": "ธนาคารอิสลามแห่งประเทศไทย" },
        { "Bank Code": "063", "Bank": "TSCO", "Bank Name": "ธนาคารทิสโก้ จำกัด (มหาชน)" },
        { "Bank Code": "069", "Bank": "KKBA", "Bank Name": "ธนาคารเกียรตินาคิน จำกัด (มหาชน)" },
        { "Bank Code": "070", "Bank": "ICBC", "Bank Name": "ธนาคารไอซีบีซี (ไทย) จำกัด (มหาชน)" },
        { "Bank Code": "071", "Bank": "TCRB", "Bank Name": "ธนาคารไทยเครดิต เพื่อรายย่อย จำกัด (มหาชน)" },
        { "Bank Code": "073", "Bank": "LHBA", "Bank Name": "ธนาคารแลนด์ แอนด์ เฮ้าส์ จำกัด (มหาชน)" }
    ];


    private bankEnum = this.bankData.reduce((acc, bank) => {
        acc[bank.Bank] = bank["Bank Code"];
        return acc;
    }, {} as { [key: string]: string });

    private checkTextForBankCode(text: string): string {
        for (const bank in this.bankEnum) {
            if (text.includes(bank)) {
                return this.bankEnum[bank];
            }
        }
        return '';
    }

    transfromToOneplaybet(data: ResponseKobBank): OneplaybetHookDto {

        const patternDatetime: RegExp = /<span style="display:none;">(\d+)<\/span>/;

        // Find the match of the pattern in the HTML
        const timeFormat = data.time.match(patternDatetime);

        return {
            paymentDatetime: Number(timeFormat ? timeFormat[1] : 0),
            formAccountCodeName: this.checkTextForBankCode(data.detail),
            formAccountNumber: data.atranferer,
            amount: Number(data.value),
            paymentCodeName: 'KBANK',
            paymentAccountNumber: '1862450694',
            oneagentCode: '',
            remark: data.detail,
            channel: 'WEB',
            remainingBalance: 0
        }
    }

    async callApiBank() {
        return new Promise<AxiosResponse>(async (resolve, reject) => {
            try {
                const scaperKobBank = {
                    method: "POST",
                    maxBodyLength: Infinity,
                    url: `http://ec2-54-251-220-23.ap-southeast-1.compute.amazonaws.com/transaction/call_api/kbank`,
                    referrerPolicy: "strict-origin-when-cross-origin",
                    headers: {
                        accept: '*/*',
                        'accept-language': 'en-US,en;q=0.9',
                        'x-requested-with': 'XMLHttpRequest',
                        cookie: this.cookie
                    },
                    data: null,
                };
                const response = await axios(scaperKobBank);
                resolve(response.data);
            } catch (e) {
                reject({ status: false, message: "callApiBank failed!", error: e });
            }
        });
    }

    async scaperKobBank() {
        return new Promise<AxiosResponse>(async (resolve, reject) => {
            try {
                const scaperKobBank = {
                    method: "POST",
                    maxBodyLength: Infinity,
                    url: `http://ec2-54-251-220-23.ap-southeast-1.compute.amazonaws.com/transaction/index/all/0/today/json`,
                    referrerPolicy: "strict-origin-when-cross-origin",
                    headers: {
                        accept: '*/*',
                        'accept-language': 'en-US,en;q=0.9',
                        'x-requested-with': 'XMLHttpRequest',
                        cookie: this.cookie
                    },
                    data: null,
                };
                const response = await axios(scaperKobBank);
                resolve(response.data);
            } catch (e) {
                reject({ status: false, message: "scaperKobBank failed!", error: e });
            }
        });
    }

    async sendOneAgent(data?: OneplaybetHookDto) {
        return new Promise(async (resolve, reject) => {
            try {
                const sendOneAgent = {
                    method: "POST",
                    maxBodyLength: Infinity,
                    url: `https://api-agent.oneplaybet.com/v1/payment/external-deposit/oneagent`,
                    headers: {
                        "Content-Type": "application/json; charset=UTF-8",
                    },
                    data: JSON.stringify(data)
                };
                const response = await axios(sendOneAgent);
                resolve(response);
            } catch (e) {
                reject({ status: false, message: "sendOneAgent failed!", error: e });
            }
        });
    }
}

schedule.scheduleJob('12 * * * * *', async function() {
    console.log('hey!');

      
    let lib = new KobBankAdapter()
    // const cachedData = await redis.get('cache_kob_opb_last_sent');

    // console.log('iv buffer', lib.ivMain = Buffer.from('6E639C164B4B9198', 'utf-8'));
    // await lib.callApiBank()
    setTimeout(async () => {
        const scraper = await lib.scaperKobBank()
        // console.log("🚀 ~ setTimeout ~ scraper:", scraper)
        scraper.data.forEach(async (element: any) => {
            const data = lib.transfromToOneplaybet(element);
            console.log('data ', data);
            // const opb = await lib.sendOneAgent(data)
            // console.log('opb response ', opb);
        });

        // await redis.set('cachedData', 105, 'EX', 3600);
    }, 3000);
});
// (async () => {
    
//     let lib = new KobBankAdapter()
//     const cachedData = await redis.get('cache_kob_opb_last_sent');

//     // console.log('iv buffer', lib.ivMain = Buffer.from('6E639C164B4B9198', 'utf-8'));
//     // await lib.callApiBank()
//     setTimeout(async () => {
//         const scraper = await lib.scaperKobBank()
//         console.log("🚀 ~ setTimeout ~ scraper:", scraper)
//         scraper.data.forEach(async (element: any) => {
//             const data = lib.transfromToOneplaybet(element);
//             console.log('data ', data);
//             // const opb = await lib.sendOneAgent(data)
//             // console.log('opb response ', opb);
//         });

//         await redis.set('cachedData', 105, 'EX', 3600);
//     }, 3000);
//     // console.log('response ', scraper);

// }
// )()
