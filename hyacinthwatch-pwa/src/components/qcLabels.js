export function blurLabel(qc) {
    if (!qc || typeof qc.blur_var !== 'number') return null;
    const v = qc.blur_var;
    if (v >= 200) return { text: 'Sharp', style: { background: '#10b981' } };
    if (v >= 20) return { text: 'Okay focus', style: { background: '#f59e0b' } };
    return { text: 'Blurry', style: { background: '#ef4444' } };
}

export function brightLabel(qc) {
    if (!qc || typeof qc.brightness !== 'number') return null;
    const b = qc.brightness;
    if (b >= 200) return { text: 'Bright', style: { background: '#f59e0b' } };
    if (b >= 50) return { text: 'Okay light', style: { background: '#10b981' } };
    return { text: 'Dark', style: { background: '#ef4444' } };
}

export function Badge({ label }) {
    if (!label) return null;
    return (
        <span style={{
            ...label.style,
            color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 12, marginRight: 6
        }}>{label.text}</span>
    );
}
