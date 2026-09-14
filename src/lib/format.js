export const money=n=>new Intl.NumberFormat('ku-IQ',{maximumFractionDigits:0}).format(Number(n||0))+' د.ع'
