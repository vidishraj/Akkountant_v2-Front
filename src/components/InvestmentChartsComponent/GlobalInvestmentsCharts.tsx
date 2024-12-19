import {BarChart} from '@mui/x-charts/BarChart';
import {PieChart} from '@mui/x-charts';
import styles from './InvestmentCharts.module.scss';
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import {useEffect, useState} from "react";
import Slider, {Settings} from "react-slick";
import './dotsStyle.css'
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const GlobalInvestmentsCharts = () => {
    const {state} = useMSNContext();
    const [barChartSeries, setBarChartSeries] = useState<any>([
        {label: 'Total Investment', data: []},
        {label: 'Current Value', data: []},
    ]);
    const [barChartOrder, setBarChartOrder] = useState<any>([]);
    const [pieChartSeries, setPieChartSeries] = useState<any>([{data: []}]);
    const msnContextKeys = ["mf", "stocks", "nps"];
    const epgContextKeys = ["ppf", "epf", "gold"];

    useEffect(() => {
        const order: any = [];
        const totalInvestmentSeries: number[] = [];
        const currentValueSeries: number[] = [];
        const pieSeries: any[] = [];

        msnContextKeys.forEach((key) => {
            const data = state.summaries[key];
            order.push(key);
            totalInvestmentSeries.push(Number(data.totalValue));
            currentValueSeries.push(Number(data.currentValue));
            pieSeries.push({
                id: key,
                value: Number(data.totalValue),
                label: key,
            });
        });

        epgContextKeys.forEach((key) => {
            const data = state.summaries[key];
            order.push(key);
            totalInvestmentSeries.push(Number(data.net) - Number(data.netProfit));
            currentValueSeries.push(Number(data.net));
            pieSeries.push({
                id: key,
                value: Number(data.net),
                label: key,
            });
        });

        setBarChartSeries([
            {label: 'Total Investment', data: totalInvestmentSeries},
            {label: 'Current Value', data: currentValueSeries},
        ]);
        setPieChartSeries([{data: pieSeries}]);
        setBarChartOrder(order);
    }, [state.summaries]);

    // Carousel settings
    const sliderSettings: Settings = {
        dots: true,
        infinite: true,
        speed: 500,
        slidesToShow: 1,
        slidesToScroll: 1,
        adaptiveHeight: true,
        centerMode: true,
        arrows: true,
    };

    return (
        <Slider {...sliderSettings} className={styles.carousel}>
            {/* BarChart Slide */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'blue',
            }}>
                <BarChart
                    className={styles.barChart}
                    xAxis={[{scaleType: 'band', data: barChartOrder}]}
                    series={barChartSeries}
                    slotProps={{
                        legend: {
                            labelStyle: {fill: '#FAFAFA'},
                        },
                    }}
                    width={500}
                    sx={{
                        "& .MuiChartsAxis-tickContainer .MuiChartsAxis-tickLabel": {fontFamily: "Roboto"},
                        "& .MuiChartsAxis-bottom .MuiChartsAxis-tickLabel": {fill: "#FAFAFA"},
                        "& .MuiChartsAxis-bottom .MuiChartsAxis-line": {stroke: "#FAFAFA", strokeWidth: 1.4},
                        "& .MuiChartsAxis-left .MuiChartsAxis-line": {stroke: "#FAFAFA", strokeWidth: 1},
                        "& .MuiChartsAxis-left .MuiChartsAxis-tickLabel": {fill: "#FAFAFA"},
                    }}
                    height={300}
                />
            </div>

            {/* PieChart Slide */}
            <div>
                <PieChart
                    series={pieChartSeries}
                    width={400}
                    height={200}
                    slotProps={{
                        legend: {
                            labelStyle: {fill: '#FAFAFA'},
                        },
                    }}
                />
            </div>
        </Slider>
    );
};

export default GlobalInvestmentsCharts;
