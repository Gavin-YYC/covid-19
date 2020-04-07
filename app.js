/**
 * @file 疫情
 * @author Gavin
 */

/* eslint-disable fecs-camelcase, fecs-no-require, no-console */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const moment = require('moment');


const COUNTRY_LIST = [
    {en: 'US', cn: '美国'},
    {en: 'Spain', cn: '西班牙'},
    {en: 'Italy', cn: '意大利'},
    {en: 'Germany', cn: '德国'},
    {en: 'France', cn: '法国'},
    {en: 'China', cn: '中国'},
    {en: 'Iran', cn: '伊朗'},
    {en: 'United Kingdom', cn: '英国'},
    {en: 'Turkey', cn: '土耳其'},
    {en: 'Switzerland', cn: '瑞士'},
    {en: 'Belgium', cn: '比利时'},
    {en: 'Netherlands', cn: '荷兰'},
    {en: 'Canada', cn: '加拿大'},
    {en: 'Austria', cn: '奥地利'},
    {en: 'Portugal', cn: '葡萄牙'}
];

/**
 * 数据主区模块
 */
class Spider {
    constructor(countryList) {
        this.countryList = countryList;
    }

    async getData() {
        const dataList = [];
        for (const country of this.countryList) {
            const res = await this.getCountryData(country.en);
            const data = this.filterData(country, res);
            console.log(`获取[${country.cn}]数据 - ${data.data.length}}`);
            dataList.push(data);
        }

        return dataList;
    }

    filterData(country, data) {
        const obj = Object.assign({}, country, {data: []});
        obj.data = data.map(({attributes}) => {
            return {
                date: moment(attributes.Last_Update).format('MM-DD'),
                Deaths: attributes.Deaths,
                Confirmed: attributes.Confirmed,
                Delta_Confirmed: attributes.Delta_Confirmed
            };
        });
        return obj;
    }

    // 从约翰斯·霍普金斯大学疫情统计官网拉数据
    async getCountryData(country) {
        const res = await axios.request({
            url: '/FeatureServer/4/query',
            params: {
                f: 'json',
                where: `Country_Region='${country}'`,
                rnGeometry: 'false',
                spatialRel: 'esriSpatialRelIntersects',
                outFields: 'OBJECTID,Confirmed,Delta_Confirmed,Deaths,Last_Update',
                orderByFields: 'Last_Update asc',
                outSR: '102100',
                resultOffset: '0',
                resultRecordCount: '1000',
                cacheHint: 'true'
            },
            baseURL: 'https://services9.arcgis.com/N9p5hsImWXAccRNI/arcgis/rest/services/Nc2JKvYFoAEOFCG5JSI6',
            headers: {referer: 'https://www.arcgis.com/apps/opsdashboard/index.html'}
        });

        if (res.status === 200) {
            return res.data.features;
        }

        return [];
    }
}

/**
 * 图表数据格式化模块
 */
class Chart {
    constructor(data) {
        this.data = data;
    }

    updateData(data) {
        this.data = data;
        return this;
    }

    format(type) {
        // 提取所有日期
        const dateArr = [];
        this.data.forEach(country => {
            const arr = country.data.map(item => item.date);
            Object.assign(dateArr, arr);
        });

        // 跟进日期填充数据
        const series = this.data.map(country => {
            const list = country.data;
            const dateList = list.map(item => item.date);
            return {
                name: country.cn,
                type: 'line',
                data: dateArr.map(date => {
                    const i = dateList.indexOf(date);
                    return list[i][type] || 0;
                })
            };
        });

        return {
            dateArr,
            series
        };
    }

    getChartObject() {
        const {dateArr: confirmDateArr, series: confirmSeries} = this.format('Confirmed');
        const legend = confirmSeries.map(item => item.name);
        const confirm = {
            title: {text: '主要疫情国家确诊趋势图'},
            tooltip: {trigger: 'axis'},
            legend: {data: legend},
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: confirmDateArr
            },
            yAxis: {
                type: 'value'
            },
            series: confirmSeries
        };

        const {dateArr: deathDataArr, series: deathSeries} = this.format('Confirmed');
        const death = {
            title: {text: '主要疫情国家确诊趋势图'},
            tooltip: {trigger: 'axis'},
            legend: {data: legend},
            xAxis: {
                type: 'category',
                data: deathDataArr
            },
            yAxis: {
                type: 'value'
            },
            series: deathSeries
        };

        return {
            death,
            confirm,
            ratio: {}
        };
    }

    buildHtml() {
        const {confirm} = this.getChartObject();
        const html = [
            '<!DOCTYPE html>',
            '<html>',
            '<head>',
                '<meta charset="utf-8">',
                '<script src="https://cdn.bootcss.com/echarts/4.7.0/echarts.min.js"></script>',
                '<style>',
                    '* {margin: 0; padding: 0;}',
                    '#main {display: flex; height: 100vh; width: 100vw;}',
                '</style>',
            '</head>',
            '<body>',
                '<div id="main">',
                '</div>',
                '<script type="text/javascript">',
                    'window.onload = function() {',
                        'var confirm = echarts.init(document.getElementById("main"));',
                        `confirm.setOption(${JSON.stringify(confirm)});`,
                    '}',
                '</script>',
            '</body>',
            '</html>'
        ].join('');

        return html;
    }

    saveHtml(html) {
        const file = path.join(__dirname, 'index.html');
        fs.writeFileSync(file, html, {
            encoding: 'utf-8'
        });
    }
}


async function main() {
    const dataPath = path.resolve('./data.json');
    const chart = new Chart();
    let json = null;

    if (fs.existsSync(dataPath)) {
        json = require(dataPath);
    }
    else {
        const spider = new Spider(COUNTRY_LIST);
        json = await spider.getData();
    }

    const html = chart.updateData(json).buildHtml();
    chart.saveHtml(html);

    // 更新数据
    fs.writeFileSync('./data.json', JSON.stringify(json), {
        encoding: 'utf-8'
    });
}

main();
