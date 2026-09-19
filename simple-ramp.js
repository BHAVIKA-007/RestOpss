import http from "k6/http";
import { check } from "k6";

export const options = {
    scenarios: {
        load: {
            executor: "ramping-vus",
            startVUs: 0,
            stages: [
                { duration: "5s", target: 100 },
                { duration: "5s", target: 200 },
                { duration: "5s", target: 300 },
            ],
            gracefulRampDown: "1s",
        },
    },
};

export default function () {
    const res = http.get("http://localhost:5000/api/load-test");

    check(res, {
        "status is 200": (r) => r.status === 200,
    });
}