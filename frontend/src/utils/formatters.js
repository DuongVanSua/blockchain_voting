
export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};


export const formatDate = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp * 1000).toLocaleString('vi-VN');
};


export const formatNumber = (num) => {
  if (!num) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};


export const formatPercentage = (value, total) => {
  if (!total || total === 0) return '0.00';
  return ((value / total) * 100).toFixed(2);
};
