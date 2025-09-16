import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  fetchFreelanceDashboard,
  fetchEarningsByDateRange,
} from "../../services/freelanceService";
import { FreelanceDashboard as DashboardData, FreelanceEarning } from "../../utils/interfaces";
import { useMessage } from "../../contexts/MessageContext";
import { currencyService } from "../../services/currencyService";
import styles from "../../pages/Freelance/Freelance.module.scss";

interface FreelanceDashboardProps {
  refreshTrigger?: number;
  isActive?: boolean;
}

const FreelanceDashboard = ({ refreshTrigger, isActive = true }: FreelanceDashboardProps = {}) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filteredEarnings, setFilteredEarnings] = useState<FreelanceEarning[]>([]);
  const [showFilteredResults, setShowFilteredResults] = useState(false);
  const [selectedClientInfo, setSelectedClientInfo] = useState<{ client: string; totalAmount: number; paidAmount: number; pendingAmount: number } | null>(null);
  const { setPayload } = useMessage();

  useEffect(() => {
    loadDashboardData();
  }, [refreshTrigger]);

  useEffect(() => {
    if (isActive) {
      loadDashboardData();
    }
  }, [isActive]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await fetchFreelanceDashboard(true); // Always clear cache for fresh data
      setDashboardData(data);

      // Update currency rates in background
      currencyService.updateExchangeRates().catch(console.warn);
    } catch (error) {
      setPayload({
        type: "error",
        message: "Failed to load dashboard data. Backend connection required.",
      });
      console.error("Dashboard loading error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeFilter = async () => {
    if (!startDate || !endDate) {
      setPayload({
        type: "error",
        message: "Please select both start and end dates",
      });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setPayload({
        type: "error",
        message: "Start date cannot be after end date",
      });
      return;
    }

    try {
      setLoading(true);
      const earnings = await fetchEarningsByDateRange(startDate, endDate);
      setFilteredEarnings(earnings);
      setShowFilteredResults(true);
      setPayload({
        type: "success",
        message: `Found ${earnings.length} earnings in selected date range`,
      });
    } catch (error) {
      setPayload({
        type: "error",
        message:
          "Failed to fetch earnings for date range. Backend connection required.",
      });
      console.error("Date range filter error:", error);
    } finally {
      setLoading(false);
    }
  };

  const clearDateFilter = () => {
    setShowFilteredResults(false);
    setFilteredEarnings([]);
    setStartDate("");
    setEndDate("");
    setShowDateFilter(false);
  };

  const formatCurrency = (amount: number, currency: string = "INR") => {
    const locale = currency === "INR" ? "en-IN" : "en-US";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatBaseCurrency = (amount: number) => {
    return formatCurrency(amount, "INR");
  };

  const getINRConversion = (amount: number, currency: string) => {
    if (currency === "INR") return amount;
    return currencyService.convertToINRSync(amount, currency);
  };

  const formatWithINRConversion = (amount: number, currency: string) => {
    const originalFormatted = formatCurrency(amount, currency);
    if (currency === "INR") {
      return originalFormatted;
    }
    const inrAmount = getINRConversion(amount, currency);
    return `${originalFormatted} (₹${inrAmount.toLocaleString("en-IN")})`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "#32CD32";
      case "overdue":
        return "#DC143C";
      default:
        // Treat any non-paid status as pending
        return "#FFD700";
    }
  };

  const normalizeStatus = (status: string) => {
    return status === "paid" ? "paid" : status === "overdue" ? "overdue" : "pending";
  };

  const COLORS = ["#7B68EE", "#32CD32", "#FFD700", "#FF6347", "#20B2AA", "#FF69B4", "#FFA500", "#9932CC"];
  const COLORS_SECONDARY = ["#9370DB", "#3CB371", "#F0E68C", "#FA8072", "#48D1CC", "#DA70D6", "#FFB84D", "#BA55D3"];

  const calculateClientDistribution = () => {
    if (!dashboardData?.earningsByClientCombined) {
      return [];
    }
    
    // Create client distribution from combined earnings and recent invoices
    const clientTotals: Record<string, { 
      client: string; 
      paidAmount: number; 
      pendingAmount: number; 
      totalAmount: number; 
    }> = {};

    // Add combined earnings as total amounts
    dashboardData.earningsByClientCombined.forEach(item => {
      clientTotals[item.client] = {
        client: item.client,
        paidAmount: 0, // Will be calculated below
        pendingAmount: 0, // Will be calculated below
        totalAmount: item.earnings
      };
    });

    // Get paid amounts from earningsByClient
    dashboardData.earningsByClient.forEach(item => {
      if (clientTotals[item.client]) {
        clientTotals[item.client].paidAmount = item.earnings;
        clientTotals[item.client].pendingAmount = clientTotals[item.client].totalAmount - item.earnings;
      }
    });

    // Ensure pending amounts are not negative
    Object.values(clientTotals).forEach(client => {
      if (client.pendingAmount < 0) {
        client.pendingAmount = 0;
      }
    });

    return Object.values(clientTotals)
      .filter(item => item.totalAmount > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount);
  };


  if (loading) {
    return (
      <div className={styles.loadingSpinner}>
        <div>Loading dashboard...</div>
      </div>
    );
  }

  if (!dashboardData) {
    return <div className={styles.emptyState}>No dashboard data available</div>;
  }

  return (
    <div>
      {/* Date Filter Controls */}
      <div className={styles.invoiceForm} style={{ marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
          }}
        >
          <h3 style={{ color: "#FAFAFA", margin: 0 }}>
            📊 Dashboard Analytics
          </h3>
          <button
            className={styles.secondaryBtn}
            onClick={() => setShowDateFilter(!showDateFilter)}
          >
            {showDateFilter ? "✕ Hide Filter" : "📅 Filter by Date Range"}
          </button>
        </div>

        {showDateFilter && (
          <div
            style={{
              padding: "20px",
              backgroundColor: "#29384D",
              borderRadius: "8px",
              border: "1px solid #5B5B7B",
            }}
          >
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Start Date</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>End Date</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", alignItems: "end", gap: "10px" }}>
                <button
                  className={styles.primaryBtn}
                  onClick={handleDateRangeFilter}
                  disabled={loading || !startDate || !endDate}
                >
                  {loading ? "Filtering..." : "🔍 Apply Filter"}
                </button>
                {showFilteredResults && (
                  <button
                    className={styles.secondaryBtn}
                    onClick={clearDateFilter}
                    disabled={loading}
                  >
                    ✕ Clear Filter
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Show filtered results or dashboard */}
      {showFilteredResults ? (
        <div className={styles.chartContainer}>
          <h3 className={styles.sectionTitle}>
            Earnings from {new Date(startDate).toLocaleDateString()} to{" "}
            {new Date(endDate).toLocaleDateString()}
          </h3>
          {filteredEarnings.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #5B5B7B" }}>
                    <th
                      style={{
                        color: "#FAFAFA",
                        padding: "12px",
                        textAlign: "left",
                      }}
                    >
                      Date
                    </th>
                    <th
                      style={{
                        color: "#FAFAFA",
                        padding: "12px",
                        textAlign: "left",
                      }}
                    >
                      Invoice #
                    </th>
                    <th
                      style={{
                        color: "#FAFAFA",
                        padding: "12px",
                        textAlign: "left",
                      }}
                    >
                      Client
                    </th>
                    <th
                      style={{
                        color: "#FAFAFA",
                        padding: "12px",
                        textAlign: "left",
                      }}
                    >
                      Project
                    </th>
                    <th
                      style={{
                        color: "#FAFAFA",
                        padding: "12px",
                        textAlign: "right",
                      }}
                    >
                      Amount
                    </th>
                    <th
                      style={{
                        color: "#FAFAFA",
                        padding: "12px",
                        textAlign: "center",
                      }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEarnings.map((earning, index) => (
                    <tr
                      key={index}
                      style={{ borderBottom: "1px solid #5B5B7B" }}
                    >
                      <td style={{ color: "#FAFAFA", padding: "12px" }}>
                        {new Date(earning.date).toLocaleDateString()}
                      </td>
                      <td style={{ color: "#FAFAFA", padding: "12px" }}>
                        {earning.invoiceNumber}
                      </td>
                      <td style={{ color: "#FAFAFA", padding: "12px" }}>
                        {earning.clientName}
                      </td>
                      <td style={{ color: "#FAFAFA", padding: "12px" }}>
                        {earning.projectName}
                      </td>
                      <td
                        style={{
                          color: "#FAFAFA",
                          padding: "12px",
                          textAlign: "right",
                          fontWeight: "bold",
                        }}
                      >
                        {earning.status === "paid" ? (
                          formatBaseCurrency(
                            earning.paidAmount || earning.amount
                          )
                        ) : (
                          <div>
                            <div>
                              {formatCurrency(
                                earning.amount,
                                earning.currency || "USD"
                              )}
                            </div>
                            {earning.currency !== "INR" && (
                              <div
                                style={{ fontSize: "0.7rem", color: "#B0B0B0" }}
                              >
                                ≈ ₹
                                {getINRConversion(
                                  earning.amount,
                                  earning.currency || "USD"
                                ).toLocaleString("en-IN")}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td
                        style={{
                          color: getStatusColor(earning.status),
                          padding: "12px",
                          textAlign: "center",
                          fontWeight: "bold",
                        }}
                      >
                        {normalizeStatus(earning.status).toUpperCase()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                style={{
                  marginTop: "15px",
                  padding: "10px",
                  backgroundColor: "rgba(123, 104, 238, 0.1)",
                  borderRadius: "4px",
                  textAlign: "center",
                }}
              >
                <strong style={{ color: "#7B68EE" }}>
                  Total Paid (INR):{" "}
                  {formatBaseCurrency(
                    filteredEarnings
                      .filter((earning) => earning.status === "paid")
                      .reduce(
                        (sum, earning) =>
                          sum + (earning.paidAmount || earning.amount),
                        0
                      )
                  )}
                </strong>
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              No earnings found in the selected date range.
            </div>
          )}
        </div>
      ) : (
        // Original dashboard content
        <>
          {/* Key Metrics */}
          <div className={styles.dashboardGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>
                {formatBaseCurrency(dashboardData.totalEarnings)}
              </div>
              <div className={styles.metricLabel}>Total Paid (INR)</div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricValue}>
                {formatBaseCurrency(dashboardData.monthlyEarnings)}
              </div>
              <div className={styles.metricLabel}>This Month (INR)</div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricValue}>
                {dashboardData.unpaidByCurrency &&
                dashboardData.unpaidByCurrency.length > 0
                  ? formatBaseCurrency(
                      dashboardData.unpaidByCurrency.reduce(
                        (sum, item) =>
                          sum + getINRConversion(item.amount, item.currency),
                        0
                      )
                    )
                  : formatBaseCurrency(0)}
              </div>
              <div className={styles.metricLabel}>Unpaid Value (INR)</div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricValue}>
                {dashboardData.completedProjects}
              </div>
              <div className={styles.metricLabel}>Completed Projects</div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricValue}>
                {dashboardData.activeClients}
              </div>
              <div className={styles.metricLabel}>Active Clients</div>
            </div>
          </div>

          {/* Monthly Paid Earnings Chart (Base Currency) */}
          <div className={styles.chartContainer}>
            <h3 className={styles.sectionTitle}>
              Monthly Paid Earnings Trend (INR)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dashboardData.earningsByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#5B5B7B" />
                <XAxis dataKey="month" stroke="#FAFAFA" />
                <YAxis stroke="#FAFAFA" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#29384D",
                    border: "1px solid #5B5B7B",
                    borderRadius: "4px",
                    color: "#FAFAFA",
                  }}
                  formatter={(value: number) => [
                    formatBaseCurrency(value),
                    "Paid Earnings",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="earnings"
                  stroke="#32CD32"
                  strokeWidth={3}
                  dot={{ fill: "#32CD32", strokeWidth: 2, r: 6 }}
                  activeDot={{ r: 8, fill: "#228B22" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Unpaid Invoices by Currency */}
          {dashboardData.unpaidByCurrency &&
            dashboardData.unpaidByCurrency.length > 0 && (
              <div className={styles.chartContainer}>
                <h3 className={styles.sectionTitle}>
                  Unpaid Invoices by Currency
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData.unpaidByCurrency}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#5B5B7B" />
                    <XAxis dataKey="currency" stroke="#FAFAFA" />
                    <YAxis stroke="#FAFAFA" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#29384D",
                        border: "1px solid #5B5B7B",
                        borderRadius: "4px",
                        color: "#FAFAFA",
                      }}
                      formatter={(value: number, _name: string, props: { payload?: { currency?: string } }) => [
                        formatWithINRConversion(value, props.payload?.currency || 'USD'),
                        "Unpaid Amount",
                      ]}
                    />
                    <Bar
                      dataKey="amount"
                      fill="#FFD700"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

          {/* Paid Earnings by Client Chart (Base Currency) */}
          <div className={styles.chartContainer}>
            <h3 className={styles.sectionTitle}>
              Paid Earnings by Client (INR)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dashboardData.earningsByClient}>
                <CartesianGrid strokeDasharray="3 3" stroke="#5B5B7B" />
                <XAxis dataKey="client" stroke="#FAFAFA" />
                <YAxis stroke="#FAFAFA" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#29384D",
                    border: "1px solid #5B5B7B",
                    borderRadius: "4px",
                    color: "#FAFAFA",
                  }}
                  formatter={(value: number) => [
                    formatBaseCurrency(value),
                    "Paid Earnings",
                  ]}
                />
                <Bar dataKey="earnings" fill="#7B68EE" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Client Distribution Analysis */}
          <div className={styles.chartContainer}>
            <h3 className={styles.sectionTitle}>
              Client Distribution Analysis (All Converted to INR)
            </h3>
            
            {/* Client Information Display */}
            {selectedClientInfo && (
              <div style={{
                marginBottom: '20px',
                padding: '15px',
                backgroundColor: '#29384D',
                borderRadius: '8px',
                border: '2px solid #7B68EE'
              }}>
                <h4 style={{color: '#7B68EE', margin: '0 0 10px 0'}}>
                  📊 {selectedClientInfo.client} - Detailed Breakdown
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '15px',
                  color: '#FAFAFA'
                }}>
                  <div>
                    <strong style={{color: '#32CD32'}}>Total Paid:</strong><br />
                    {formatBaseCurrency(selectedClientInfo.paidAmount)}
                  </div>
                  <div>
                    <strong style={{color: '#FFD700'}}>Pending:</strong><br />
                    {formatBaseCurrency(selectedClientInfo.pendingAmount)}
                  </div>
                  <div>
                    <strong style={{color: '#7B68EE'}}>Total Value:</strong><br />
                    {formatBaseCurrency(selectedClientInfo.totalAmount)}
                  </div>
                </div>
                <button
                  className={styles.secondaryBtn}
                  onClick={() => setSelectedClientInfo(null)}
                  style={{marginTop: '10px', padding: '5px 10px', fontSize: '0.8rem'}}
                >
                  ✕ Close
                </button>
              </div>
            )}

            {/* Summary Table of All Clients */}
            <div style={{ marginBottom: '20px', overflowX: 'auto' }}>
              {calculateClientDistribution().length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#29384D', borderRadius: '8px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #5B5B7B' }}>
                      <th style={{ color: '#FAFAFA', padding: '12px', textAlign: 'left' }}>Client</th>
                      <th style={{ color: '#32CD32', padding: '12px', textAlign: 'right' }}>Paid (INR)</th>
                      <th style={{ color: '#FFD700', padding: '12px', textAlign: 'right' }}>Pending (INR)</th>
                      <th style={{ color: '#7B68EE', padding: '12px', textAlign: 'right' }}>Total (INR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculateClientDistribution().map((client) => (
                      <tr key={client.client} style={{ borderBottom: '1px solid #5B5B7B' }}>
                        <td style={{ color: '#FAFAFA', padding: '12px', fontWeight: 'bold' }}>
                          {client.client}
                        </td>
                        <td style={{ color: '#32CD32', padding: '12px', textAlign: 'right' }}>
                          {formatBaseCurrency(client.paidAmount || 0)}
                        </td>
                        <td style={{ color: '#FFD700', padding: '12px', textAlign: 'right' }}>
                          {formatBaseCurrency(client.pendingAmount || 0)}
                        </td>
                        <td style={{ color: '#7B68EE', padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                          {formatBaseCurrency(client.totalAmount || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center', 
                  backgroundColor: '#29384D', 
                  borderRadius: '8px',
                  color: '#FFD700'
                }}>
                  ⚠️ Client distribution data not available. Make sure your backend includes the earningsByClientCombined field.
                </div>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : '1fr 1fr',
              gap: '20px'
            }}>
              {/* Paid Earnings Pie Chart */}
              <div>
                <h4 style={{ color: '#FAFAFA', textAlign: 'center', marginBottom: '15px' }}>
                  Paid Earnings Distribution
                </h4>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={dashboardData.earningsByClient.filter(item => item.earnings > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ client, percent }) =>
                        percent && percent > 0 ? `${client}: ${((percent) * 100).toFixed(0)}%` : ''
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="earnings"
                    >
                      {dashboardData.earningsByClient.filter(item => item.earnings > 0).map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#29384D",
                        border: "1px solid #5B5B7B",
                        borderRadius: "4px",
                        color: "#FAFAFA",
                      }}
                      formatter={(value: number) => [
                        formatBaseCurrency(value),
                        "Paid Earnings",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Total Client Distribution Pie Chart (Paid + Pending) */}
              <div>
                <h4 style={{ color: '#FAFAFA', textAlign: 'center', marginBottom: '15px' }}>
                  Total Client Distribution (All Currencies → INR)
                </h4>
                {dashboardData?.earningsByClientCombined && dashboardData.earningsByClientCombined.filter(item => item.earnings > 0).length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={dashboardData.earningsByClientCombined.filter(item => item.earnings > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ client, percent }) =>
                          percent && percent > 0 ? `${client}: ${((percent) * 100).toFixed(0)}%` : ''
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="earnings"
                        onClick={(data) => {
                          // Find the client data from calculated distribution for detailed breakdown
                          const clientData = calculateClientDistribution().find(item => item.client === data.client);
                          if (clientData) {
                            setSelectedClientInfo(clientData);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {dashboardData.earningsByClientCombined.filter(item => item.earnings > 0).map((_, index) => (
                          <Cell
                            key={`cell-total-${index}`}
                            fill={COLORS_SECONDARY[index % COLORS_SECONDARY.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#29384D",
                          border: "1px solid #5B5B7B",
                          borderRadius: "4px",
                          color: "#FAFAFA",
                        }}
                        formatter={(value: number) => [
                          formatBaseCurrency(value),
                          "Total Value (Paid + Pending)",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ 
                    height: '300px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: '#29384D',
                    borderRadius: '8px',
                    color: '#FFD700'
                  }}>
                    📊 Waiting for earningsByClientCombined data from backend
                  </div>
                )}
                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                  <p style={{ 
                    color: '#B0B0B0', 
                    fontSize: '0.8rem', 
                    marginBottom: '5px'
                  }}>
                    💡 Click on a sector to see detailed breakdown
                  </p>
                  <p style={{ 
                    color: '#A0A0A0', 
                    fontSize: '0.7rem', 
                    fontStyle: 'italic'
                  }}>
                    Exchange rates: USD→INR (83), GBP→INR (105), INR (1:1)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Invoices */}
          <div className={styles.chartContainer}>
            <h3 className={styles.sectionTitle}>Recent Invoices</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #5B5B7B" }}>
                    <th
                      style={{
                        color: "#FAFAFA",
                        padding: "12px",
                        textAlign: "left",
                      }}
                    >
                      Invoice #
                    </th>
                    <th
                      style={{
                        color: "#FAFAFA",
                        padding: "12px",
                        textAlign: "left",
                      }}
                    >
                      Client
                    </th>
                    <th
                      style={{
                        color: "#FAFAFA",
                        padding: "12px",
                        textAlign: "left",
                      }}
                    >
                      Project
                    </th>
                    <th
                      style={{
                        color: "#FAFAFA",
                        padding: "12px",
                        textAlign: "left",
                      }}
                    >
                      Amount
                    </th>
                    <th
                      style={{
                        color: "#FAFAFA",
                        padding: "12px",
                        textAlign: "left",
                      }}
                    >
                      Status
                    </th>
                    <th
                      style={{
                        color: "#FAFAFA",
                        padding: "12px",
                        textAlign: "left",
                      }}
                    >
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.recentInvoices.map((invoice, index) => (
                    <tr
                      key={index}
                      style={{ borderBottom: "1px solid #5B5B7B" }}
                    >
                      <td style={{ color: "#FAFAFA", padding: "12px" }}>
                        {invoice.invoiceNumber}
                      </td>
                      <td style={{ color: "#FAFAFA", padding: "12px" }}>
                        {invoice.clientName}
                      </td>
                      <td style={{ color: "#FAFAFA", padding: "12px" }}>
                        {invoice.projectName}
                      </td>
                      <td style={{ color: "#FAFAFA", padding: "12px" }}>
                        {invoice.status === "paid" ? (
                          formatBaseCurrency(
                            invoice.paidAmount || invoice.amount
                          )
                        ) : (
                          <div>
                            <div>
                              {formatCurrency(
                                invoice.amount,
                                invoice.currency || "USD"
                              )}
                            </div>
                            {invoice.currency !== "INR" && (
                              <div
                                style={{ fontSize: "0.7rem", color: "#B0B0B0" }}
                              >
                                ≈ ₹
                                {getINRConversion(
                                  invoice.amount,
                                  invoice.currency || "USD"
                                ).toLocaleString("en-IN")}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td
                        style={{
                          color: getStatusColor(invoice.status),
                          padding: "12px",
                          fontWeight: "bold",
                        }}
                      >
                        {normalizeStatus(invoice.status).toUpperCase()}
                      </td>
                      <td style={{ color: "#FAFAFA", padding: "12px" }}>
                        {new Date(invoice.date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FreelanceDashboard;
