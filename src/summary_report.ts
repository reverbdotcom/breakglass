import { getClosedInPastWeek, getDetailedPR } from './github';
import { ExportToCsv } from 'export-to-csv';
import { postMessage } from './slack';

export async function summaryReport() {
  const options = {
    fieldSeparator: ',',
    quoteStrings: '"',
    decimalSeparator: '.',
    showLabels: true,
    useTextFile: false,
    useBom: true,
    useKeysAsHeaders: true,
  };

  try {
    const csvExporter = new ExportToCsv(options);
    const data = [];
    const pullRequests = await getClosedInPastWeek();

    for(const pr of pullRequests) {
      const detailed_pr = await getDetailedPR(pr.number);
      const row = createRow(detailed_pr);
      data.push(row);
    }

    // For why we pass in true:
    // https://github.com/alexcaza/export-to-csv/issues/2
    await postMessage(csvExporter.generateCsv(data, true));
  } catch (error) {
    await postMessage("Summary report creation failed! 🔥");
    throw error;
  }
}

function createRow(pr) {
  return {
    url: pr.html_url,
    title: pr.title,
    creator: pr.user.login,
    merged: pr.merged,
    merged_by: pr.merged_by.login,
    closed_at: pr.closed_at,
    labels: pr.labels,
    review_comments: pr.review_comments,
  };
}
