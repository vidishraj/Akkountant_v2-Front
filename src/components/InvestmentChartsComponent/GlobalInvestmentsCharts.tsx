import {BarChart} from '@mui/x-charts/BarChart';
import {PieChart} from '@mui/x-charts';
import styles from './InvestmentCharts.module.scss';
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import {useEffect, useRef, useState} from "react";
import Slider, {Settings} from "react-slick";
import './dotsStyle.css';
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const CHART_COLORS: Record<string, string> = {
    stocks: "#4a9eff",
    mf: "#9c27b0",
    nps: "#ff9800",
    epf: "#4caf50",
    ppf: "#00bcd4",
    gold: "#ffd700",
};

const CHART_LABELS: Record<string, string> = {
    stocks: "Stocks",
    mf: "MF",
    nps: "NPS",
    epf: "EPF",
    ppf: "PPF",
    gold: "Gold",
};

const msnContextKeys = ["mf", "stocks", "nps"];
const epgContextKeys = ["ppf", "epf", "gold"];
const allKeys = [...msnContextKeys, ...epgContextKeys];

const axisSx = {
    "& .MuiChartsAxis-tickContainer .MuiChartsAxis-tickLabel": {fontFamily: "Roboto"},
    "& .MuiChartsAxis-bottom .MuiChartsAxis-tickLabel": {fill: "#ccd0d5", fontSize: 12},
    "& .MuiChartsAxis-bottom .MuiChartsAxis-line": {stroke: "#29384D", strokeWidth: 1},
    "& .MuiChartsAxis-left .MuiChartsAxis-line": {stroke: "#29384D", strokeWidth: 1},
    "& .MuiChartsAxis-left .MuiChartsAxis-tickLabel": {fill: "#7a7d85", fontSize: 11},
    "& .MuiChartsGrid-line": {stroke: "#1a2530", strokeWidth: 1},
};

const tooltipSx = {
    "& .MuiChartsTooltip-root": {backgroundColor: "#121c24 !important", color: "#fafafa !important"},
    "& .MuiChartsTooltip-table": {backgroundColor: "#121c24 !important", color: "#fafafa !important"},
    "& .MuiChartsTooltip-paper": {backgroundColor: "#121c24 !important", color: "#fafafa !important", border: "1px solid #29384D !important"},
    "& .MuiPaper-root": {backgroundColor: "#121c24 !important", color: "#fafafa !important"},
};

const GlobalInvestmentsCharts = () => {
    const {state} = useMSNContext();
    const [barChartSeries, setBarChartSeries] = useState<any>([
        {label: 'Invested', data: []},
        {label: 'Total Value', data: []},
    ]);
    const [barChartOrder, setBarChartOrder] = useState<any>([]);
    const [pieChartSeries, setPieChartSeries] = useState<any>([{data: []}]);
    const [isMobile, setIsMobile] = useState<boolean>(false);
    const [chartWidth, setChartWidth] = useState(500);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateSize = () => {
            setIsMobile(window.innerWidth <= 900);
            if (containerRef.current) {
                const w = containerRef.current.offsetWidth - 40; // account for carousel padding
                setChartWidth(Math.max(280, Math.min(w, 600)));
            }
        };

        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    useEffect(() => {
        const order: string[] = [];
        const totalInvestmentSeries: number[] = [];
        const currentValueSeries: number[] = [];
        const pieSeries: any[] = [];

        msnContextKeys.forEach((key) => {
            const data = state.summaries[key];
            order.push(CHART_LABELS[key]);
            totalInvestmentSeries.push(Number(data.totalValue));
            currentValueSeries.push(Number(data.currentValue));
            pieSeries.push({
                id: key,
                value: Number(data.currentValue),
                label: CHART_LABELS[key],
                color: CHART_COLORS[key],
            });
        });

        epgContextKeys.forEach((key) => {
            const data = state.summaries[key];
            order.push(CHART_LABELS[key]);
            totalInvestmentSeries.push(Number(data.net) - Number(data.netProfit));
            currentValueSeries.push(Number(data.net));
            pieSeries.push({
                id: key,
                value: Number(data.net),
                label: CHART_LABELS[key],
                color: CHART_COLORS[key],
            });
        });

        setBarChartSeries([
            {label: 'Invested', data: totalInvestmentSeries, color: '#7a7d85'},
            {label: 'Current Value', data: currentValueSeries, color: '#4a9eff'},
        ]);
        setPieChartSeries([{
            data: pieSeries,
            innerRadius: 40,
            outerRadius: 100,
            paddingAngle: 2,
            cornerRadius: 4,
        }]);
        setBarChartOrder(order);
    }, [state.summaries]);

    const sliderSettings: Settings = {
        dots: true,
        infinite: true,
        speed: 500,
        slidesToShow: 1,
        slidesToScroll: 1,
        adaptiveHeight: true,
        centerMode: false,
        arrows: !isMobile,
    };

    return (
        <div ref={containerRef}>
            <Slider {...sliderSettings} className={styles.carousel}>
                {/* BarChart Slide */}
                <div className={styles.innerBox}>
                    <BarChart
                        xAxis={[{
                            scaleType: 'band',
                            data: barChartOrder,
                            colorMap: {
                                type: 'ordinal',
                                colors: allKeys.map(k => CHART_COLORS[k]),
                            },
                        }]}
                        series={barChartSeries}
                        grid={{horizontal: true}}
                        borderRadius={4}
                        slotProps={{
                            legend: {
                                labelStyle: {fill: '#ccd0d5', fontSize: 12},
                            },
                        }}
                        width={chartWidth}
                        height={300}
                        sx={{...axisSx, ...tooltipSx}}
                    />
                </div>

                {/* PieChart Slide */}
                <div className={styles.innerBox}>
                    <PieChart
                        series={pieChartSeries}
                        width={chartWidth}
                        height={300}
                        slotProps={{
                            legend: {
                                labelStyle: {fill: '#ccd0d5', fontSize: 12},
                                direction: 'row',
                                position: {vertical: 'bottom', horizontal: 'middle'},
                            },
                        }}
                        sx={{...tooltipSx}}
                    />
                </div>
            </Slider>
        </div>
    );
};

export default GlobalInvestmentsCharts;
