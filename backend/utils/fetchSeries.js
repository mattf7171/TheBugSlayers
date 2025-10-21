// backend/utils/fetchSeries.js
import axios from "axios";
import dayjs from "dayjs";

export async function fetchDailySeries(ticker, startISO, numDays, apiKey) {
  const start = dayjs(startISO);
  const end = start.add(numDays, "day");
  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${start.format("YYYY-MM-DD")}/${end.format("YYYY-MM-DD")}`;
  const { data } = await axios.get(url, {
    params: { adjusted: "true", sort: "asc", limit: 50000, apiKey }
  });

  if (!data || !Array.isArray(data.results) || data.results.length === 0) {
    throw new Error("No trading data returned for requested window.");
  }

  // Normalize to { date: 'YYYY-MM-DD', close: number }
  return data.results.map(r => ({
    date: dayjs(r.t).format("YYYY-MM-DD"),
    close: r.c
  }));
}
