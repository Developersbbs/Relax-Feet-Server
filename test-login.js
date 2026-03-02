async function testLogin() {
    try {
        const regRes = await fetch('https://relax-feet-server-yuqz.onrender.com/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: "testuser_" + Date.now(),
                email: "test_" + Date.now() + "@test.com",
                password: "password123",
                role: "superadmin"
            })
        });
        const regData = await regRes.json();
        console.log("Register:", regRes.status, regData);

        if (regRes.status !== 201 && regRes.status !== 200 && !regData.user) return;

        const emailToLogin = regData.user ? regData.user.email : "admin@test.com";

        const loginRes = await fetch('https://relax-feet-server-yuqz.onrender.com/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: emailToLogin,
                password: "password123"
            })
        });
        const loginData = await loginRes.json();
        console.log("Login:", loginRes.status, loginData);
    } catch (err) {
        console.error("Error:", err.message);
    }
}
testLogin();
