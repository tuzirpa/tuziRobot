
/**
 * 格式化日期 根据时间戳
 * @param timestamp 时间戳
 * @param format 格式
 * @returns 格式化后的日期
 */
export function formatDate(date: Date, format: string = 'yyyy-MM-dd HH:mm:ss') {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();
    //格式 yyyy-MM-dd HH:mm:ss 
    return format.replace('yyyy', year.toString())
        .replace('MM', month.toString().padStart(2, '0'))
        .replace('dd', day.toString().padStart(2, '0'))
        .replace('HH', hour.toString().padStart(2, '0'))
        .replace('mm', minute.toString().padStart(2, '0'))
        .replace('ss', second.toString().padStart(2, '0'));
}